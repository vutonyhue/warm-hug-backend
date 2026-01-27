-- =============================================
-- FIX: Update notifications insert policy
-- =============================================
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- OAUTH/SSO POLICIES (Service role only for sensitive data)
-- =============================================

-- OAuth clients: Read only for authenticated
CREATE POLICY "Anyone can view active oauth clients"
ON public.oauth_clients FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage oauth clients"
ON public.oauth_clients FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- OAuth codes: Service role only (edge functions)
CREATE POLICY "Service role manages oauth codes"
ON public.oauth_codes FOR ALL
TO service_role
USING (true);

-- OTP codes: Service role only
CREATE POLICY "Service role manages otp codes"
ON public.otp_codes FOR ALL
TO service_role
USING (true);

-- Cross platform tokens: Service role and own data
CREATE POLICY "Users can view own tokens"
ON public.cross_platform_tokens FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages tokens"
ON public.cross_platform_tokens FOR ALL
TO service_role
USING (true);

-- Platform user data
CREATE POLICY "Users can view own platform data"
ON public.platform_user_data FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages platform data"
ON public.platform_user_data FOR ALL
TO service_role
USING (true);

-- Platform financial data
CREATE POLICY "Users can view own financial data"
ON public.platform_financial_data FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages financial data"
ON public.platform_financial_data FOR ALL
TO service_role
USING (true);

-- Account merge requests
CREATE POLICY "Users can view own merge requests"
ON public.account_merge_requests FOR SELECT
TO authenticated
USING (auth.uid() = source_user_id OR auth.uid() = target_user_id);

CREATE POLICY "Users can create merge requests"
ON public.account_merge_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = source_user_id);

CREATE POLICY "Admins can manage merge requests"
ON public.account_merge_requests FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Pending provisions: Service role only
CREATE POLICY "Service role manages provisions"
ON public.pending_provisions FOR ALL
TO service_role
USING (true);

-- =============================================
-- FINANCIAL POLICIES
-- =============================================

-- Transactions
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Reward claims
CREATE POLICY "Users can view own claims"
ON public.reward_claims FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create claims"
ON public.reward_claims FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage claims"
ON public.reward_claims FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Reward approvals: Admin only
CREATE POLICY "Admins can view approvals"
ON public.reward_approvals FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create approvals"
ON public.reward_approvals FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reward adjustments: Admin only
CREATE POLICY "Admins can view adjustments"
ON public.reward_adjustments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create adjustments"
ON public.reward_adjustments FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Financial transactions: User own + admin view
CREATE POLICY "Users can view own financial transactions"
ON public.financial_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all financial transactions"
ON public.financial_transactions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages financial transactions"
ON public.financial_transactions FOR ALL
TO service_role
USING (true);

-- Reconciliation logs: Admin only
CREATE POLICY "Admins can view reconciliation logs"
ON public.reconciliation_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages reconciliation logs"
ON public.reconciliation_logs FOR ALL
TO service_role
USING (true);

-- Audit logs: Admin only
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Blacklisted wallets: Admin only
CREATE POLICY "Admins can view blacklist"
ON public.blacklisted_wallets FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage blacklist"
ON public.blacklisted_wallets FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Search logs
CREATE POLICY "Users can create search logs"
ON public.search_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view search logs"
ON public.search_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Rate limit state: Service role
CREATE POLICY "Service role manages rate limits"
ON public.rate_limit_state FOR ALL
TO service_role
USING (true);

-- Soul NFTs
CREATE POLICY "Users can view own NFT"
ON public.soul_nfts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view NFTs"
ON public.soul_nfts FOR SELECT
USING (true);

CREATE POLICY "Service role manages NFTs"
ON public.soul_nfts FOR ALL
TO service_role
USING (true);

-- Custodial wallets: User own only (no private key exposure)
CREATE POLICY "Users can view own wallet"
ON public.custodial_wallets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages wallets"
ON public.custodial_wallets FOR ALL
TO service_role
USING (true);

-- Livestreams
CREATE POLICY "Anyone can view active livestreams"
ON public.livestreams FOR SELECT
USING (status = 'live');

CREATE POLICY "Users can view own livestreams"
ON public.livestreams FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own livestreams"
ON public.livestreams FOR ALL
TO authenticated
USING (auth.uid() = user_id);