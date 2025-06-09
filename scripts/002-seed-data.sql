-- Insert sample user (password would be hashed in real application)
INSERT INTO users (name, email, password_hash) VALUES 
('Demo User', 'demo@example.com', '$2b$10$example_hash_here')
ON CONFLICT (email) DO NOTHING;

-- Get the user ID for the demo user
DO $$
DECLARE
    demo_user_id INTEGER;
BEGIN
    SELECT id INTO demo_user_id FROM users WHERE email = 'demo@example.com';
    
    -- Insert sample applications
    INSERT INTO applications (user_id, company, role, role_link, date_applied, status, notes) VALUES 
    (demo_user_id, 'TechCorp', 'Senior Frontend Developer', 'https://techcorp.com/careers/frontend-dev', '2024-01-15', 'Interview Scheduled', 'Had initial phone screening with HR. Technical interview scheduled for next week.'),
    (demo_user_id, 'StartupXYZ', 'Full Stack Engineer', 'https://startupxyz.com/jobs/fullstack', '2024-01-10', 'Applied', 'Applied through their website. Waiting for response.'),
    (demo_user_id, 'BigTech Inc', 'React Developer', 'https://bigtech.com/careers/react-dev', '2024-01-05', 'Interviewed', 'Completed technical interview. Waiting for final decision.'),
    (demo_user_id, 'InnovateCo', 'Frontend Engineer', 'https://innovateco.com/jobs/frontend', '2024-01-01', 'Rejected', 'Received rejection email after technical assessment.'),
    (demo_user_id, 'GrowthStartup', 'Senior Developer', 'https://growthstartup.com/careers/senior-dev', '2023-12-28', 'Offer', 'Received offer! Negotiating salary and benefits.');
    
    -- Insert sample LinkedIn profiles
    INSERT INTO linkedin_profiles (application_id, profile_url, name, title) VALUES 
    ((SELECT id FROM applications WHERE company = 'TechCorp' AND user_id = demo_user_id), 'https://linkedin.com/in/hiring-manager-techcorp', 'Sarah Johnson', 'Engineering Manager'),
    ((SELECT id FROM applications WHERE company = 'TechCorp' AND user_id = demo_user_id), 'https://linkedin.com/in/team-lead-techcorp', 'Mike Chen', 'Senior Team Lead'),
    ((SELECT id FROM applications WHERE company = 'BigTech Inc' AND user_id = demo_user_id), 'https://linkedin.com/in/recruiter-bigtech', 'Emily Davis', 'Technical Recruiter');
END $$;
