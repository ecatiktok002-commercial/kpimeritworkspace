-- Migration: Add 20 Core Achievements for Rental Operations
-- This script populates the achievements table with the specific rental-focused goals requested.

INSERT INTO public.achievements (icon, title, description, trigger_type) VALUES
('stars', '5-Star Streak', 'Maintain a perfect 5.0 customer rating for 10 consecutive rentals.', 'MANUAL'),
('speed', 'Flash Handover', 'Complete five vehicle handovers in under 15 minutes each.', 'MANUAL'),
('clean_hands', 'Pristine Fleet', 'Pass five consecutive vehicle cleanliness inspections with zero remarks.', 'MANUAL'),
('nights_stay', 'Midnight Hero', 'Successfully manage three off-hour ground handling tasks or key handovers.', 'MANUAL'),
('gavel', 'Zero Summons', 'Keep a managed vehicle free of traffic or parking summons for 30 days.', 'MANUAL'),
('psychology', 'The Decoy Master', 'Successfully convert three 1-day inquiries into 3-day weekend bookings using decoy pricing.', 'MANUAL'),
('chat', 'WhatsApp Wizard', 'Achieve a 40% conversion rate on incoming WhatsApp leads for one week.', 'MANUAL'),
('rebase_edit', 'Retention King', 'Secure three repeat bookings from customers who previously rented only once.', 'MANUAL'),
('upgrade', 'The Upsell Ace', 'Successfully upgrade a daily rental customer to a higher-tier vehicle model.', 'MANUAL'),
('group_add', 'Referral Rockstar', 'Generate three confirmed bookings through personal or agent referrals.', 'MANUAL'),
('security', 'Semak Sentinel', 'Successfully identify and block a high-risk lead using the background screening platform.', 'MANUAL'),
('minor_crash', 'Fleet Guardian', 'Detect and report a vehicle maintenance issue before it causes a rental disruption.', 'MANUAL'),
('tire_repair', 'Tire Tech', 'Ensure all 12 vehicles in the fleet have optimal tire pressure and fluid levels for the week.', 'MANUAL'),
('description', 'Document Dynamo', 'Achieve 100% accuracy in rental agreement documentation for 20 consecutive deals.', 'MANUAL'),
('videocam', 'TikTok Trailblazer', 'Create one TikTok video that achieves over 1,000 organic views.', 'MANUAL'),
('movie', 'Content King', 'Submit five high-quality "cinematic" vehicle clips for the company marketing bank.', 'MANUAL'),
('bolt', 'Viral Spark', 'Have your content mentioned or shared by a customer on their personal social media.', 'MANUAL'),
('lightbulb', 'Workflow Winner', 'Propose one operational improvement that is officially implemented by the team.', 'MANUAL'),
('school', 'Agent Ally', 'Successfully mentor a new agent through their first three successful bookings.', 'MANUAL'),
('schedule', 'Punctual Pro', 'Achieve 100% on-time arrival for all shifts and handovers for one full month.', 'MANUAL');
