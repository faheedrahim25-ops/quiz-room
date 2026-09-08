INSERT INTO subjects (department_id, name, code)
SELECT d.id, 'General Quiz', 'QUIZ'
FROM departments d
WHERE d.code = 'CS'
ON CONFLICT (code) DO NOTHING;
