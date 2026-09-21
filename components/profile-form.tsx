"use client";

import * as React from "react";
import { UserProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, AlertTriangle, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  profile: UserProfile;
  email: string;
}

export function ProfileForm({ profile, email }: ProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = React.useState(profile.full_name || "");
  const [phone, setPhone] = React.useState(profile.phone || "");
  const [department, setDepartment] = React.useState(profile.department || "");
  const [program, setProgram] = React.useState(profile.program || "");
  const [year, setYear] = React.useState(profile.year ? String(profile.year) : "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatar_url || "");
  const [qualification, setQualification] = React.useState(profile.qualification || "");
  const [semester, setSemester] = React.useState(profile.semester || "");
  const [skillsText, setSkillsText] = React.useState(profile.skills?.join(", ") || "");
  const [interestsText, setInterestsText] = React.useState(profile.career_interests?.join(", ") || "");

  const [isSaving, setIsSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    const supabase = createClient();

    try {
      // Update permitted fields only - role is strictly omitted and immutable
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          department: department.trim() || null,
          program: program.trim() || null,
          year: year ? parseInt(year, 10) : null,
          avatar_url: avatarUrl.trim() || null,
          qualification: qualification.trim() || null,
          semester: semester.trim() || null,
          skills: skillsText ? skillsText.split(",").map(s => s.trim()).filter(Boolean) : [],
          career_interests: interestsText ? interestsText.split(",").map(s => s.trim()).filter(Boolean) : [],
        })
        .eq("id", profile.id);

      if (error) throw error;

      setStatusMessage({
        type: "success",
        text: "Profile updated successfully. Changes are now reflected across the platform.",
      });

      router.refresh();
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Readonly Account Governance Card */}
      <Card className="bg-ayush-sand/30 border-ayush-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">System Credentials & Role Governance</CardTitle>
            <Badge
              variant={
                profile.role === "student"
                  ? "herbal"
                  : profile.role === "faculty"
                  ? "saffron"
                  : "default"
              }
              className="uppercase"
            >
              {profile.role}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Core identity and role authorization managed by platform governance
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-ayush-muted">Registered Email</span>
            <div className="text-xs font-semibold text-ayush-dark truncate">{email}</div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-ayush-muted">Assigned System Role</span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ayush-dark capitalize">
              <Lock className="w-3 h-3 text-ayush-muted" />
              <span>{profile.role} (Immutable)</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-ayush-muted">Profile Created</span>
            <div className="text-xs text-ayush-muted">
              {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "Active"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable Profile Form */}
      <Card accent="green">
        <CardHeader>
          <CardTitle>Edit Academic & Professional Details</CardTitle>
          <CardDescription className="text-xs">
            Update your public profile and educational coordinates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Vaidya Ramanathan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Contact Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department / Specialization</Label>
                <Input
                  id="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Dravyaguna / Kayachikitsa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="program">Academic Program / Degree</Label>
                <Input
                  id="program"
                  type="text"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  placeholder="e.g. BAMS / MD (Ayurveda)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">Academic Year / Experience</Label>
                <Input
                  id="year"
                  type="number"
                  min={1}
                  max={50}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 4"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification Level</Label>
                <Input
                  id="qualification"
                  type="text"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. Undergraduate (UG)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="semester">Current Semester</Label>
                <Input
                  id="semester"
                  type="text"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  placeholder="e.g. Professional Year II"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Skills & Competencies (comma separated)</Label>
              <Input
                id="skills"
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="e.g. Nadi Pariksha, Panchakarma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="career_interests">Career Interests (comma separated)</Label>
              <Input
                id="career_interests"
                type="text"
                value={interestsText}
                onChange={(e) => setInterestsText(e.target.value)}
                placeholder="e.g. Clinical Practice, Research"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar Image URL (Optional)</Label>
              <Input
                id="avatar_url"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                  statusMessage.type === "success"
                    ? "bg-ayush-green/10 border-ayush-green/30 text-ayush-green"
                    : "bg-ayush-terracotta/10 border-ayush-terracotta/30 text-ayush-terracotta"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="submit"
                variant="secondary"
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save Profile Changes"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
