-- Migration: 20260910071151_seed_ayurveda_competencies.sql
-- Description: Seed initial Ayush / Ayurveda competency dataset for Student Skill Assessment
-- Context: Ministry of Ayush / All India Institute of Ayurveda ecosystem (MVP framework)
-- Data Migration: Idempotent insertion using WHERE NOT EXISTS to avoid duplicates.
-- Provenance Policy: Official NCISM/AIIA resources and verifiable URLs; no invented module titles.

INSERT INTO public.competencies (
  name,
  category,
  description,
  source,
  source_reference,
  is_active
)
SELECT
  v.name,
  v.category,
  v.description,
  v.source,
  v.source_reference,
  true
FROM (
  VALUES
    -- =========================================================================
    -- ACADEMIC / DOMAIN (academic_domain)
    -- =========================================================================
    (
      'Ayurvedic Foundational Understanding',
      'academic_domain',
      'Understanding fundamental concepts and principles of Ayurveda.',
      'NCISM BAMS Curriculum',
      'https://ncismindia.org/ (NCISM Competency Based Dynamic Curriculum for BAMS)'
    ),
    (
      'Application of Ayurvedic Concepts',
      'academic_domain',
      'Applying learned Ayurvedic principles in relevant academic or practical contexts.',
      'NCISM BAMS Curriculum',
      'https://ncismindia.org/ (NCISM Competency Based Dynamic Curriculum for BAMS)'
    ),
    (
      'Contemporary Medical Understanding',
      'academic_domain',
      'Understanding relevant contemporary medical concepts alongside Ayurvedic learning.',
      'Platform-defined competency derived from official sources',
      'Derived from integrated contemporary science subjects in NCISM BAMS Curriculum (https://ncismindia.org/)'
    ),

    -- =========================================================================
    -- CLINICAL / PRACTICAL (clinical_practical)
    -- =========================================================================
    (
      'Clinical History and Examination',
      'clinical_practical',
      'Ability to gather relevant clinical information and perform appropriate clinical examination.',
      'NCISM Shishiksha (Internship Orientation Programme)',
      'https://ncismindia.org/assets/pdf/SHISHIKSHA%20%28INTERSHIP%20ORIENTATION%20PROGRAM%29.pdf'
    ),
    (
      'Clinical Interpretation',
      'clinical_practical',
      'Ability to interpret relevant clinical findings and diagnostic information.',
      'NCISM Shishiksha (Internship Orientation Programme)',
      'https://ncismindia.org/assets/pdf/SHISHIKSHA%20%28INTERSHIP%20ORIENTATION%20PROGRAM%29.pdf'
    ),
    (
      'Patient Communication',
      'clinical_practical',
      'Ability to communicate clearly and appropriately with patients.',
      'NCISM Shishiksha (Internship Orientation Programme)',
      'https://ncismindia.org/assets/pdf/SHISHIKSHA%20%28INTERSHIP%20ORIENTATION%20PROGRAM%29.pdf'
    ),
    (
      'Clinical Documentation and Record Keeping',
      'clinical_practical',
      'Ability to maintain accurate clinical information and records.',
      'NCISM Shishiksha (Internship Orientation Programme)',
      'https://ncismindia.org/assets/pdf/SHISHIKSHA%20%28INTERSHIP%20ORIENTATION%20PROGRAM%29.pdf'
    ),

    -- =========================================================================
    -- RESEARCH (research)
    -- =========================================================================
    (
      'Research Methodology',
      'research',
      'Understanding fundamental research methodology.',
      'NCISM Research Methodology & Medical Statistics Curriculum',
      'https://ncismindia.org/8.%20NCISM_IIIBAMS_AyUG-RM.pdf'
    ),
    (
      'Statistical Understanding',
      'research',
      'Understanding basic statistical concepts used in research.',
      'NCISM Research Methodology & Medical Statistics Curriculum',
      'https://ncismindia.org/8.%20NCISM_IIIBAMS_AyUG-RM.pdf'
    ),
    (
      'Evidence-Based Practice',
      'research',
      'Ability to understand and use relevant evidence to support professional learning and practice.',
      'NCISM Research Methodology & Medical Statistics Curriculum',
      'https://ncismindia.org/8.%20NCISM_IIIBAMS_AyUG-RM.pdf'
    ),
    (
      'Scientific Communication',
      'research',
      'Ability to communicate research findings in a clear scientific format.',
      'NCISM Research Methodology & Medical Statistics Curriculum',
      'https://ncismindia.org/8.%20NCISM_IIIBAMS_AyUG-RM.pdf'
    ),

    -- =========================================================================
    -- PROFESSIONAL (professional)
    -- =========================================================================
    (
      'Professional Ethics and Conduct',
      'professional',
      'Demonstrating ethical and professional behaviour.',
      'NCISM Shishiksha (Internship Orientation Programme)',
      'https://ncismindia.org/assets/pdf/SHISHIKSHA%20%28INTERSHIP%20ORIENTATION%20PROGRAM%29.pdf'
    ),
    (
      'Teamwork and Professional Communication',
      'professional',
      'Ability to communicate and work effectively in professional teams.',
      'NCISM Shishiksha (Internship Orientation Programme)',
      'https://ncismindia.org/assets/pdf/SHISHIKSHA%20%28INTERSHIP%20ORIENTATION%20PROGRAM%29.pdf'
    )
) AS v(name, category, description, source, source_reference)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.competencies c
  WHERE c.name = v.name
);
