"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserProfile } from "@/lib/auth-helpers";
import { saveStudentProfile } from "./actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User,
  GraduationCap,
  Building2,
  Sparkles,
  Compass,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";

interface InstitutionItem {
  id: string;
  name: string;
  code?: string | null;
  category?: string | null;
  location?: string | null;
  verification_status?: string | null;
}

interface CompleteProfileFormProps {
  profile: UserProfile;
  userEmail: string;
  institutions: InstitutionItem[];
}

const PRESET_SKILLS = [
  "Nadi Pariksha (Pulse Diagnosis)",
  "Panchakarma Procedures",
  "Prakriti Analysis",
  "Dravyaguna & Herb Identification",
  "Rasa Shastra & Formulation",
  "Sanskrit Samhita Recitation",
  "Kshar Sutra Application",
  "Clinical Case Documentation",
  "Diagnostic Protocols in Ayush",
  "Pathya-Apathya (Dietetics)",
  "Research Methodology",
];

const PRESET_CAREER_INTERESTS = [
  "Clinical Practice & OPD",
  "Ayush R&D & Formulation",
  "Ayurvedic Hospital Management",
  "Academics & Faculty Teaching",
  "Government Ayush Services (CCRAS/State)",
  "Medical Tourism & Wellness",
  "Medical Writing & Pharmacovigilance",
  "Integrative Medicine Research",
];

export function CompleteProfileForm({
  profile,
  userEmail,
  institutions,
}: CompleteProfileFormProps) {
  const router = useRouter();

  // Personal details
  const [fullName, setFullName] = React.useState(profile.full_name || "");
  const [phone, setPhone] = React.useState(profile.phone || "");

  // Academic details
  const [qualification, setQualification] = React.useState(profile.qualification || "Undergraduate (UG)");
  const [program, setProgram] = React.useState(profile.program || "BAMS - Bachelor of Ayurvedic Medicine and Surgery");
  const [customProgram, setCustomProgram] = React.useState("");
  const [department, setDepartment] = React.useState(profile.department || "Kayachikitsa");
  const [customDepartment, setCustomDepartment] = React.useState("");
  const [year, setYear] = React.useState(profile.year ? String(profile.year) : "1");
  const [semester, setSemester] = React.useState(profile.semester || "Professional Year I");

  // Institution selection (filtered strictly to approved)
  const [institutionId, setInstitutionId] = React.useState(profile.institution_id || (institutions[0]?.id ?? ""));

  // Skills & Career Interests
  const [selectedSkills, setSelectedSkills] = React.useState<string[]>(
    profile.skills && profile.skills.length > 0 ? profile.skills : ["Nadi Pariksha (Pulse Diagnosis)", "Panchakarma Procedures"]
  );
  const [customSkill, setCustomSkill] = React.useState("");

  const [selectedInterests, setSelectedInterests] = React.useState<string[]>(
    profile.career_interests && profile.career_interests.length > 0
      ? profile.career_interests
      : ["Clinical Practice & OPD"]
  );
  const [customInterest, setCustomInterest] = React.useState("");

  // Submission state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Skill toggle
  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills([...selectedSkills, trimmed]);
      setCustomSkill("");
    }
  };

  // Career interest toggle
  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (trimmed && !selectedInterests.includes(trimmed)) {
      setSelectedInterests([...selectedInterests, trimmed]);
      setCustomInterest("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side validations
    if (!fullName.trim()) {
      setErrorMessage("Please enter your full legal name.");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("Please provide a contact phone number.");
      return;
    }
    if (!institutionId) {
      setErrorMessage("Please select your affiliated Ayush institution.");
      return;
    }
    if (selectedSkills.length === 0) {
      setErrorMessage("Please select or add at least one clinical/academic skill.");
      return;
    }
    if (selectedInterests.length === 0) {
      setErrorMessage("Please select or add at least one career interest.");
      return;
    }

    const finalProgram = program === "Other" ? customProgram.trim() : program;
    if (!finalProgram) {
      setErrorMessage("Please specify your course / academic program.");
      return;
    }

    const finalDepartment = department === "Other" ? customDepartment.trim() : department;
    if (!finalDepartment) {
      setErrorMessage("Please specify your department / specialization.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await saveStudentProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        qualification,
        program: finalProgram,
        department: finalDepartment,
        year: parseInt(year, 10),
        semester,
        institution_id: institutionId,
        skills: selectedSkills,
        career_interests: selectedInterests,
      });

      if (result.success) {
        router.push("/student/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile. Please try again.");
      setIsSubmitting(false);
    }
  };

  const hasNoInstitutions = institutions.length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Account & Identity Banner */}
      <Card className="bg-ayush-sand/30 border-ayush-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-ayush-primary" />
              <CardTitle className="text-base font-heading">Personal Coordinates</CardTitle>
            </div>
            <Badge variant="herbal" className="uppercase text-[10px]">
              Student Account
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Personal identity linked to your student credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Legal Name *</Label>
              <Input
                id="full_name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Vaidya Aarav Sharma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Contact Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <span className="text-[11px] font-medium text-ayush-muted">Registered Email Address</span>
            <div className="flex items-center gap-2 text-xs font-semibold text-ayush-dark bg-ayush-sand/50 p-2.5 rounded-md border border-ayush-border/60">
              <Lock className="w-3.5 h-3.5 text-ayush-muted" />
              <span>{userEmail}</span>
              <span className="text-[10px] text-ayush-muted ml-auto font-normal">(Verified Auth)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Academic Coordinates */}
      <Card accent="green">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-ayush-green" />
            <CardTitle className="text-base font-heading">Academic Program & Specialization</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Your current enrollment details and academic year in the Ayush system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qualification">Academic Qualification Level *</Label>
              <select
                id="qualification"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                className="w-full rounded-md border border-ayush-border bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ayush-green"
              >
                <option value="Undergraduate (UG)">Undergraduate (UG)</option>
                <option value="Postgraduate (PG)">Postgraduate (PG / MD / MS)</option>
                <option value="Diploma">Diploma / Post-Graduate Diploma</option>
                <option value="Doctoral (PhD)">Doctoral (PhD / Post-Doctoral)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program">Degree Program / Course *</Label>
              <select
                id="program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="w-full rounded-md border border-ayush-border bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ayush-green"
              >
                <option value="BAMS - Bachelor of Ayurvedic Medicine and Surgery">BAMS - Bachelor of Ayurvedic Medicine and Surgery</option>
                <option value="MD (Ayurveda)">MD (Ayurveda)</option>
                <option value="MS (Ayurveda)">MS (Ayurveda)</option>
                <option value="BHMS - Bachelor of Homeopathic Medicine and Surgery">BHMS - Bachelor of Homeopathic Medicine and Surgery</option>
                <option value="BUMS - Bachelor of Unani Medicine and Surgery">BUMS - Bachelor of Unani Medicine and Surgery</option>
                <option value="BSMS - Bachelor of Siddha Medicine and Surgery">BSMS - Bachelor of Siddha Medicine and Surgery</option>
                <option value="BNYS - Bachelor of Naturopathy and Yogic Sciences">BNYS - Bachelor of Naturopathy and Yogic Sciences</option>
                <option value="Other">Other Academic Program...</option>
              </select>
              {program === "Other" && (
                <Input
                  type="text"
                  placeholder="Enter degree program name"
                  value={customProgram}
                  onChange={(e) => setCustomProgram(e.target.value)}
                  className="mt-2"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Specialization / Department *</Label>
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-md border border-ayush-border bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ayush-green"
              >
                <option value="Kayachikitsa">Kayachikitsa (Internal Medicine)</option>
                <option value="Dravyaguna">Dravyaguna (Pharmacology & Materia Medica)</option>
                <option value="Panchakarma">Panchakarma (Therapeutic Cleansing)</option>
                <option value="Shalya Tantra">Shalya Tantra (Surgery)</option>
                <option value="Shalakya Tantra">Shalakya Tantra (ENT & Ophthalmology)</option>
                <option value="Prasuti Tantra & Stri Roga">Prasuti Tantra & Stri Roga (Gynecology)</option>
                <option value="Kaumarbhritya">Kaumarbhritya (Pediatrics)</option>
                <option value="Swasthavritta">Swasthavritta & Yoga (Preventive Medicine)</option>
                <option value="Agada Tantra">Agada Tantra (Toxicology)</option>
                <option value="Rasa Shastra & Bhaishajya Kalpana">Rasa Shastra & Bhaishajya Kalpana</option>
                <option value="Roga Nidana">Roga Nidana (Diagnostics & Pathology)</option>
                <option value="Samhita & Basic Principles">Samhita & Basic Principles</option>
                <option value="Sharira Kriya">Sharira Kriya (Physiology)</option>
                <option value="Sharira Rachana">Sharira Rachana (Anatomy)</option>
                <option value="Other">Other Specialization...</option>
              </select>
              {department === "Other" && (
                <Input
                  type="text"
                  placeholder="Enter department or subject name"
                  value={customDepartment}
                  onChange={(e) => setCustomDepartment(e.target.value)}
                  className="mt-2"
                  required
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Academic Year *</Label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-md border border-ayush-border bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ayush-green"
              >
                <option value="1">1st Year (First Professional)</option>
                <option value="2">2nd Year (Second Professional)</option>
                <option value="3">3rd Year (Third Professional)</option>
                <option value="4">4th Year (Final Professional)</option>
                <option value="5">5th Year / Rotatory Internship</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Current Semester / Stage *</Label>
              <select
                id="semester"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full rounded-md border border-ayush-border bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ayush-green"
              >
                <option value="Professional Year I">Professional Year I</option>
                <option value="Professional Year II">Professional Year II</option>
                <option value="Professional Year III">Professional Year III</option>
                <option value="Professional Year IV">Professional Year IV</option>
                <option value="Compulsory Rotatory Internship">Compulsory Rotatory Internship</option>
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Semester 3">Semester 3</option>
                <option value="Semester 4">Semester 4</option>
                <option value="Semester 5">Semester 5</option>
                <option value="Semester 6">Semester 6</option>
                <option value="Semester 7">Semester 7</option>
                <option value="Semester 8">Semester 8</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Institution Association */}
      <Card className="border-ayush-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-ayush-primary" />
            <CardTitle className="text-base font-heading">Affiliated Institution</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Select your accredited college or university from the verified directory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasNoInstitutions ? (
            <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">No Approved Institutions Available</p>
                <p>
                  No approved institutions are currently available in the platform directory.
                  Please contact your institution administrator or platform support to register and verify your institution before completing registration.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="institution">Verified Institution *</Label>
              <select
                id="institution"
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                required
                className="w-full rounded-md border border-ayush-border bg-white px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ayush-green"
              >
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} {inst.code ? `(${inst.code})` : ""} {inst.location ? `— ${inst.location}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-ayush-muted">
                Displaying only institutions verified and approved by platform governance.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Skills & Competencies */}
      <Card className="border-ayush-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-base font-heading">Ayush Skills & Competencies *</CardTitle>
            </div>
            <span className="text-xs text-ayush-muted">
              {selectedSkills.length} selected
            </span>
          </div>
          <CardDescription className="text-xs">
            Select your clinical proficiencies, diagnostic skills, and academic competencies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SKILLS.map((skill) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <button
                  type="button"
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-ayush-green text-white shadow-xs"
                      : "bg-ayush-sand/50 text-ayush-dark hover:bg-ayush-sand border border-ayush-border/60"
                  }`}
                >
                  {skill} {isSelected && "✓"}
                </button>
              );
            })}
          </div>

          {/* Custom skill adder */}
          <div className="flex gap-2 pt-2">
            <Input
              type="text"
              placeholder="Add custom clinical or diagnostic skill..."
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomSkill();
                }
              }}
              className="text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomSkill}
              className="gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          {/* Selected custom chips */}
          {selectedSkills.some((s) => !PRESET_SKILLS.includes(s)) && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-ayush-muted block mb-1">Custom Skills:</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedSkills
                  .filter((s) => !PRESET_SKILLS.includes(s))
                  .map((skill) => (
                    <Badge key={skill} variant="secondary" className="gap-1 text-xs">
                      {skill}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => toggleSkill(skill)}
                      />
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Career Interests */}
      <Card className="border-ayush-border/80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-ayush-saffron" />
              <CardTitle className="text-base font-heading">Career Interests & Objectives *</CardTitle>
            </div>
            <span className="text-xs text-ayush-muted">
              {selectedInterests.length} selected
            </span>
          </div>
          <CardDescription className="text-xs">
            Specify your professional aspirations to personalize opportunities and mentorship
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CAREER_INTERESTS.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <button
                  type="button"
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-ayush-primary text-white shadow-xs"
                      : "bg-ayush-sand/50 text-ayush-dark hover:bg-ayush-sand border border-ayush-border/60"
                  }`}
                >
                  {interest} {isSelected && "✓"}
                </button>
              );
            })}
          </div>

          {/* Custom interest adder */}
          <div className="flex gap-2 pt-2">
            <Input
              type="text"
              placeholder="Add custom career objective or area..."
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomInterest();
                }
              }}
              className="text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCustomInterest}
              className="gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>

          {/* Selected custom chips */}
          {selectedInterests.some((i) => !PRESET_CAREER_INTERESTS.includes(i)) && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-ayush-muted block mb-1">Custom Interests:</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedInterests
                  .filter((i) => !PRESET_CAREER_INTERESTS.includes(i))
                  .map((interest) => (
                    <Badge key={interest} variant="secondary" className="gap-1 text-xs">
                      {interest}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => toggleInterest(interest)}
                      />
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-ayush-muted">
          <CheckCircle2 className="w-4 h-4 text-ayush-green" />
          <span>All required fields are validated server-side.</span>
        </div>

        <Button
          type="submit"
          variant="default"
          size="lg"
          disabled={isSubmitting || hasNoInstitutions}
          className="w-full sm:w-auto gap-2 bg-ayush-primary hover:bg-ayush-primary/90 font-medium text-sm"
        >
          <span>{isSubmitting ? "Saving Profile..." : "Complete Profile & Enter Dashboard"}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
  );
}
