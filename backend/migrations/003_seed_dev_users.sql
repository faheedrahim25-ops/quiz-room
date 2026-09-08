INSERT INTO roles (name)
VALUES ('ADMIN'), ('MENTOR'), ('STUDENT')
ON CONFLICT (name) DO NOTHING;

INSERT INTO departments (name, code)
VALUES ('Computer Science', 'CS')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO programs (department_id, name, code)
SELECT d.id, 'B.Sc. Computer Science', 'BSCS'
FROM departments d
WHERE d.code = 'CS'
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO academic_years (label, starts_on, ends_on)
VALUES ('2026-2027', '2026-06-01', '2027-05-31')
ON CONFLICT (label) DO NOTHING;

INSERT INTO semesters (academic_year_id, name, sequence_no)
SELECT ay.id, 'Semester 1', 1
FROM academic_years ay
WHERE ay.label = '2026-2027'
ON CONFLICT (academic_year_id, sequence_no) DO NOTHING;

INSERT INTO users (email, password_hash, first_name, last_name, phone, status)
VALUES
  ('admin@college.edu', '$argon2id$v=19$m=65536,t=3,p=4$01ip/kgjyiBKOZ+4U/i1XA$4LCFizQe0HEIyIuSvTIC4ILW90nz58GvzFgNb+I/rLU', 'Rhea', 'Kapoor', '+91-99999-00001', 'ACTIVE'),
  ('mentor@college.edu', '$argon2id$v=19$m=65536,t=3,p=4$8vm9BJPjw8KHLkH0RgptbA$ENcbvZu5gdYg14/R4tjFgkqzsn77zpMqyIfBGcGjhyc', 'Aarav', 'Sharma', '+91-99999-00002', 'ACTIVE'),
  ('student@college.edu', '$argon2id$v=19$m=65536,t=3,p=4$rVY48oR+sK/7uzUGbk8oIg$dWbR55jE2KMdcRga3mWSaD0dRi4UjWR1UgxgJJfSMaw', 'Meera', 'Nair', '+91-99999-00003', 'ACTIVE')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'ADMIN'
WHERE u.email = 'admin@college.edu'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'MENTOR'
WHERE u.email = 'mentor@college.edu'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'STUDENT'
WHERE u.email = 'student@college.edu'
ON CONFLICT DO NOTHING;

INSERT INTO faculty (user_id, employee_id, department_id, designation, status)
SELECT u.id, 'FAC-1001', d.id, 'Senior Mentor', 'ACTIVE'
FROM users u
JOIN departments d ON d.code = 'CS'
WHERE u.email = 'admin@college.edu'
ON CONFLICT (employee_id) DO UPDATE SET department_id = EXCLUDED.department_id;

INSERT INTO faculty (user_id, employee_id, department_id, designation, status)
SELECT u.id, 'FAC-1002', d.id, 'Mentor', 'ACTIVE'
FROM users u
JOIN departments d ON d.code = 'CS'
WHERE u.email = 'mentor@college.edu'
ON CONFLICT (employee_id) DO UPDATE SET department_id = EXCLUDED.department_id;

INSERT INTO students (user_id, student_register_number, department_id, program_id, academic_year_id, semester_id, admission_year, status)
SELECT u.id, 'CS-2026-001', d.id, p.id, ay.id, s.id, 2026, 'ACTIVE'
FROM users u
JOIN departments d ON d.code = 'CS'
JOIN programs p ON p.code = 'BSCS'
JOIN academic_years ay ON ay.label = '2026-2027'
JOIN semesters s ON s.academic_year_id = ay.id AND s.sequence_no = 1
WHERE u.email = 'student@college.edu'
ON CONFLICT (student_register_number) DO UPDATE SET department_id = EXCLUDED.department_id;

INSERT INTO mentor_assignments (mentor_id, student_id, assigned_by, effective_from, status)
SELECT f.id, st.id, u.id, now(), 'ACTIVE'
FROM faculty f
JOIN users u ON u.email = 'admin@college.edu'
JOIN students st ON st.student_register_number = 'CS-2026-001'
WHERE f.employee_id = 'FAC-1001'
ON CONFLICT (student_id) WHERE status = 'ACTIVE' DO NOTHING;
