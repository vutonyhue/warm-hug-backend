-- Drop existing INSERT policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Recreate as PERMISSIVE (default) for authenticated users
CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);