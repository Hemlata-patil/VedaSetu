-- ==========================================
-- Mentor Messaging + Recommendation System
-- ==========================================

-- 1. mentorship_pairs
CREATE TABLE IF NOT EXISTS public.mentorship_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, mentor_id)
);

ALTER TABLE public.mentorship_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own mentorship pairs" ON public.mentorship_pairs;
CREATE POLICY "Students can view their own mentorship pairs" 
ON public.mentorship_pairs FOR SELECT 
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Mentors can view their own mentorship pairs" ON public.mentorship_pairs;
CREATE POLICY "Mentors can view their own mentorship pairs" 
ON public.mentorship_pairs FOR SELECT 
USING (auth.uid() = mentor_id);

DROP POLICY IF EXISTS "Mentors can insert pairs" ON public.mentorship_pairs;
CREATE POLICY "Mentors can insert pairs" 
ON public.mentorship_pairs FOR INSERT 
WITH CHECK (auth.uid() = mentor_id);


-- 2. mentor_conversations
CREATE TABLE IF NOT EXISTS public.mentor_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(student_id, mentor_id)
);

ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their own conversations" ON public.mentor_conversations;
CREATE POLICY "Students can view their own conversations" 
ON public.mentor_conversations FOR SELECT 
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Mentors can view their own conversations" ON public.mentor_conversations;
CREATE POLICY "Mentors can view their own conversations" 
ON public.mentor_conversations FOR SELECT 
USING (auth.uid() = mentor_id);

DROP POLICY IF EXISTS "Mentors can insert conversations" ON public.mentor_conversations;
CREATE POLICY "Mentors can insert conversations" 
ON public.mentor_conversations FOR INSERT 
WITH CHECK (auth.uid() = mentor_id);


-- 3. mentor_messages
CREATE TABLE IF NOT EXISTS public.mentor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.mentor_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'mentor')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

-- Policy for viewing messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.mentor_messages;
CREATE POLICY "Users can view messages in their conversations" 
ON public.mentor_messages FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.mentor_conversations c 
        WHERE c.id = mentor_messages.conversation_id 
        AND (c.student_id = auth.uid() OR c.mentor_id = auth.uid())
    )
);

-- Policy for inserting messages
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.mentor_messages;
CREATE POLICY "Users can send messages to their conversations" 
ON public.mentor_messages FOR INSERT 
WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.mentor_conversations c 
        WHERE c.id = mentor_messages.conversation_id 
        AND (c.student_id = auth.uid() OR c.mentor_id = auth.uid())
    )
);


-- 4. mentor_recommendations
CREATE TABLE IF NOT EXISTS public.mentor_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.mentor_conversations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('skill', 'career', 'academic')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.mentor_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view their recommendations" ON public.mentor_recommendations;
CREATE POLICY "Students can view their recommendations" 
ON public.mentor_recommendations FOR SELECT 
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Mentors can view their recommendations" ON public.mentor_recommendations;
CREATE POLICY "Mentors can view their recommendations" 
ON public.mentor_recommendations FOR SELECT 
USING (auth.uid() = mentor_id);

DROP POLICY IF EXISTS "Mentors can insert recommendations" ON public.mentor_recommendations;
CREATE POLICY "Mentors can insert recommendations" 
ON public.mentor_recommendations FOR INSERT 
WITH CHECK (auth.uid() = mentor_id);

DROP POLICY IF EXISTS "Students can update recommendation status" ON public.mentor_recommendations;
CREATE POLICY "Students can update recommendation status" 
ON public.mentor_recommendations FOR UPDATE 
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);
