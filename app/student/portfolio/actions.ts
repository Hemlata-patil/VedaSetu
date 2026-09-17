"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  PortfolioItemInput,
  VALID_ITEM_TYPES,
  MAX_DOCUMENT_FILE_SIZE,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from "./types";

function validatePortfolioInput(data: PortfolioItemInput) {
  if (!data.title || data.title.trim().length === 0) {
    throw new Error("Title is required and cannot be empty.");
  }

  if (!VALID_ITEM_TYPES.includes(data.item_type)) {
    throw new Error(`Invalid item type: ${data.item_type}`);
  }

  if (data.start_date && data.end_date) {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);
    if (end < start) {
      throw new Error("End date cannot be earlier than start date.");
    }
  }
}

export async function createPortfolioItem(data: PortfolioItemInput) {
  try {
    const { user } = await requireRole("student");
    validatePortfolioInput(data);

    const supabase = await createClient();

    const insertPayload = {
      student_id: user.id, // Strictly derived from auth.uid()
      item_type: data.item_type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      issuer_or_organization: data.issuer_or_organization?.trim() || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      reference_url: data.reference_url?.trim() || null,
      achievement: data.achievement?.trim() || null,
    };

    const { data: item, error } = await supabase
      .from("portfolio_items")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("Error creating portfolio item:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/student/portfolio");
    revalidatePath("/student/dashboard");

    return { success: true, data: item };
  } catch (err: any) {
    console.error("createPortfolioItem exception:", err);
    return { success: false, error: err.message || "Failed to create portfolio item" };
  }
}

export async function updatePortfolioItem(id: string, data: PortfolioItemInput) {
  try {
    const { user } = await requireRole("student");
    if (!id) {
      throw new Error("Portfolio item ID is required.");
    }
    validatePortfolioInput(data);

    const supabase = await createClient();

    const updatePayload = {
      item_type: data.item_type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      issuer_or_organization: data.issuer_or_organization?.trim() || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      reference_url: data.reference_url?.trim() || null,
      achievement: data.achievement?.trim() || null,
    };

    const { data: item, error } = await supabase
      .from("portfolio_items")
      .update(updatePayload)
      .eq("id", id)
      .eq("student_id", user.id) // Enforce ownership
      .select()
      .single();

    if (error) {
      console.error("Error updating portfolio item:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/student/portfolio");
    revalidatePath("/student/dashboard");

    return { success: true, data: item };
  } catch (err: any) {
    console.error("updatePortfolioItem exception:", err);
    return { success: false, error: err.message || "Failed to update portfolio item" };
  }
}

export async function deletePortfolioItem(id: string) {
  try {
    const { user } = await requireRole("student");
    if (!id) {
      throw new Error("Portfolio item ID is required.");
    }

    const supabase = await createClient();

    // 1. Fetch associated documents to clean up Storage files
    const { data: docs } = await supabase
      .from("portfolio_documents")
      .select("id, storage_path")
      .eq("portfolio_item_id", id)
      .eq("student_id", user.id);

    if (docs && docs.length > 0) {
      const storagePaths = docs.map((d) => d.storage_path);
      await supabase.storage.from("portfolio-documents").remove(storagePaths);
      await supabase
        .from("portfolio_documents")
        .delete()
        .eq("portfolio_item_id", id)
        .eq("student_id", user.id);
    }

    // 2. Delete portfolio item
    const { error } = await supabase
      .from("portfolio_items")
      .delete()
      .eq("id", id)
      .eq("student_id", user.id); // Enforce ownership

    if (error) {
      console.error("Error deleting portfolio item:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/student/portfolio");
    revalidatePath("/student/dashboard");

    return { success: true };
  } catch (err: any) {
    console.error("deletePortfolioItem exception:", err);
    return { success: false, error: err.message || "Failed to delete portfolio item" };
  }
}

// =============================================================================
// DOCUMENT UPLOAD, REPLACEMENT, AND SIGNED URL RETRIEVAL
// =============================================================================

export async function uploadPortfolioDocument(formData: FormData) {
  try {
    const { user } = await requireRole("student");
    const portfolioItemId = formData.get("portfolio_item_id") as string;
    const file = formData.get("file") as File | null;

    if (!portfolioItemId) {
      return { success: false, error: "Portfolio item ID is required." };
    }

    if (!file || !(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please select a valid document file." };
    }

    // 1. Server-side file size validation: max 5 MB (5242880 bytes)
    if (file.size > MAX_DOCUMENT_FILE_SIZE) {
      return { success: false, error: "File size must be 5 MB or smaller." };
    }

    // 2. Server-side MIME type validation
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
      return { success: false, error: "Only PDF, JPG, and PNG files are allowed." };
    }

    const supabase = await createClient();

    // 3. Verify portfolio item belongs to authenticated student
    const { data: item, error: itemError } = await supabase
      .from("portfolio_items")
      .select("id, student_id")
      .eq("id", portfolioItemId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (itemError || !item) {
      return { success: false, error: "Portfolio item not found or unauthorized." };
    }

    // 4. Check for existing documents attached to this item (replacement flow)
    const { data: existingDocs } = await supabase
      .from("portfolio_documents")
      .select("id, storage_path")
      .eq("portfolio_item_id", portfolioItemId)
      .eq("student_id", user.id);

    // 5. Generate secure storage path: <student_id>/<portfolio_item_id>/<unique-file-name>
    const sanitizedBaseName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 100);
    const uniquePrefix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const storagePath = `${user.id}/${portfolioItemId}/${uniquePrefix}-${sanitizedBaseName}`;

    // 6. Upload file buffer to private Supabase Storage bucket
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("portfolio-documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { success: false, error: uploadError.message || "Failed to upload document to storage." };
    }

    // 7. Insert metadata record into public.portfolio_documents
    const { data: newDoc, error: insertError } = await supabase
      .from("portfolio_documents")
      .insert({
        portfolio_item_id: portfolioItemId,
        student_id: user.id, // Derived from auth session
        storage_path: storagePath,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Document record insertion error:", insertError);
      // Clean up newly uploaded file to prevent orphaned storage objects
      await supabase.storage.from("portfolio-documents").remove([storagePath]);
      return { success: false, error: insertError.message || "Failed to record document metadata." };
    }

    // 8. Clean up previously attached documents if replacing
    if (existingDocs && existingDocs.length > 0) {
      const oldPaths = existingDocs.map((d) => d.storage_path);
      const oldIds = existingDocs.map((d) => d.id);
      await supabase.storage.from("portfolio-documents").remove(oldPaths);
      await supabase
        .from("portfolio_documents")
        .delete()
        .in("id", oldIds)
        .eq("student_id", user.id);
    }

    revalidatePath("/student/portfolio");
    return { success: true, data: newDoc };
  } catch (err: any) {
    console.error("uploadPortfolioDocument exception:", err);
    return { success: false, error: err.message || "Failed to process document upload." };
  }
}

export async function deletePortfolioDocument(documentId: string) {
  try {
    const { user } = await requireRole("student");
    if (!documentId) {
      return { success: false, error: "Document ID is required." };
    }

    const supabase = await createClient();

    // 1. Fetch document ensuring student ownership
    const { data: doc, error: fetchError } = await supabase
      .from("portfolio_documents")
      .select("id, storage_path, student_id")
      .eq("id", documentId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (fetchError || !doc) {
      return { success: false, error: "Document not found or unauthorized." };
    }

    // 2. Remove storage object
    await supabase.storage.from("portfolio-documents").remove([doc.storage_path]);

    // 3. Delete document record
    const { error: deleteError } = await supabase
      .from("portfolio_documents")
      .delete()
      .eq("id", documentId)
      .eq("student_id", user.id);

    if (deleteError) {
      console.error("Error deleting portfolio document row:", deleteError);
      return { success: false, error: deleteError.message };
    }

    revalidatePath("/student/portfolio");
    return { success: true };
  } catch (err: any) {
    console.error("deletePortfolioDocument exception:", err);
    return { success: false, error: err.message || "Failed to delete document." };
  }
}

export async function getPortfolioDocumentSignedUrl(documentId: string) {
  try {
    const { user } = await requireRole("student");
    if (!documentId) {
      return { success: false, error: "Document ID is required." };
    }

    const supabase = await createClient();

    // Verify ownership
    const { data: doc, error: fetchError } = await supabase
      .from("portfolio_documents")
      .select("id, storage_path, file_name")
      .eq("id", documentId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (fetchError || !doc) {
      return { success: false, error: "Document not found or unauthorized." };
    }

    // Generate short-lived signed URL (60 seconds)
    const { data, error: signError } = await supabase.storage
      .from("portfolio-documents")
      .createSignedUrl(doc.storage_path, 60);

    if (signError || !data?.signedUrl) {
      return { success: false, error: signError?.message || "Failed to generate view URL." };
    }

    return { success: true, signedUrl: data.signedUrl, fileName: doc.file_name };
  } catch (err: any) {
    console.error("getPortfolioDocumentSignedUrl exception:", err);
    return { success: false, error: err.message || "Failed to load document." };
  }
}
