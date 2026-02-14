
-- Create Debt category
INSERT INTO public.categories (id, household_id, name) 
VALUES ('a0000001-0000-0000-0000-000000000006', '2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Debt');

-- Insert all expenses as payer Y (Sarah)
INSERT INTO public.expenses (household_id, name, amount, is_estimate, frequency_type, frequency_param, payer, benefit_x, category_id) VALUES
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Amazon: Prime', 15, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Capital One', 35, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000006'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Cat Food (monthly)', 40, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Cat Food (weekly)', 7, true, 'weekly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Contacts', 60, false, 'annual', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Gas', 70, true, 'weekly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Google', 2, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Netflix', 23, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'NYT', 6, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Rx', 30, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'SDG&E Payment Plan', 54, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000006'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Spotify', 12, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000003'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'T-mobile', 45, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000002'),
('2c928a6e-8484-4e5c-8a5a-5f29c8942eca', 'Vision Service Plan', 17, false, 'monthly', null, 'Y', 50, 'a0000001-0000-0000-0000-000000000004');
