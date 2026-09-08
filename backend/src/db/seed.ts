import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { config as loadDotEnv } from 'dotenv'
import pg from 'pg'
import { hashPassword } from '../services/auth.js'

loadDotEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })

const targetConnectionString = process.env.DATABASE_URL ?? 'postgresql://mentor360:mentor360@localhost:5432/mentor360'
const adminConnectionString = process.env.ADMIN_DATABASE_URL ?? targetConnectionString.replace(/\/[^/]+$/, '/postgres')

async function ensureDatabaseAndRole() {
  const adminPool = new pg.Pool({ connectionString: adminConnectionString })

  try {
    await adminPool.query('SELECT 1')

    const dbExists = await adminPool.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists', ['mentor360'])
    if (!dbExists.rows[0].exists) {
      await adminPool.query('CREATE DATABASE mentor360')
    }

    const roleExists = await adminPool.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists', ['mentor360'])
    if (!roleExists.rows[0].exists) {
      await adminPool.query("CREATE ROLE mentor360 WITH LOGIN PASSWORD 'mentor360'")
    } else {
      await adminPool.query("ALTER ROLE mentor360 WITH LOGIN PASSWORD 'mentor360'")
    }

    await adminPool.query('GRANT ALL PRIVILEGES ON DATABASE mentor360 TO mentor360')
    console.log('Database and role are ready.')
  } finally {
    await adminPool.end()
  }
}

async function applyMigrations() {
  const targetPool = new pg.Pool({ connectionString: targetConnectionString })

  try {
    const migrationFiles = ['001_initial.sql', '002_refresh_sessions.sql', '003_seed_dev_users.sql', '004_add_quiz_join_codes.sql', '005_seed_quiz_subject.sql']
    for (const fileName of migrationFiles) {
      const migrationPath = fileURLToPath(new URL(`../../migrations/${fileName}`, import.meta.url))
      const sql = await readFile(migrationPath, 'utf8')
      await targetPool.query(sql)
      console.log(`Applied migration: ${fileName}`)
    }
  } finally {
    await targetPool.end()
  }
}

async function seedData() {
  const pool = new pg.Pool({ connectionString: targetConnectionString })

  try {
    const adminHash = await hashPassword('Admin@123')
    const mentorHash = await hashPassword('Mentor@123')
    const studentHash = await hashPassword('Student@123')

    const roles = await pool.query<{ name: string; id: string }>('SELECT id, name FROM roles')
    const roleMap = new Map(roles.rows.map((role) => [role.name, role.id]))

    if (!roleMap.has('ADMIN')) {
      await pool.query("INSERT INTO roles (name) VALUES ('ADMIN'), ('MENTOR'), ('STUDENT')")
    }

    const departmentId = await pool.query<{ id: string }>(`INSERT INTO departments (name, code) VALUES ('Computer Science', 'CS') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`)
    const programId = await pool.query<{ id: string }>(`INSERT INTO programs (department_id, name, code) VALUES ($1, 'B.Sc. Computer Science', 'BSCS') ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [departmentId.rows[0].id])
    const academicYearId = await pool.query<{ id: string }>(`INSERT INTO academic_years (label, starts_on, ends_on) VALUES ('2026-2027', '2026-06-01', '2027-05-31') ON CONFLICT (label) DO NOTHING RETURNING id`)
    const semesterId = await pool.query<{ id: string }>(`INSERT INTO semesters (academic_year_id, name, sequence_no) VALUES ((SELECT id FROM academic_years WHERE label = '2026-2027'), 'Semester 1', 1) ON CONFLICT (academic_year_id, sequence_no) DO NOTHING RETURNING id`)

    const adminUser = await pool.query<{ id: string }>(`INSERT INTO users (email, password_hash, first_name, last_name, phone, status) VALUES ('admin@college.edu', $1, 'Rhea', 'Kapoor', '+91-99999-00001', 'ACTIVE') ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [adminHash])
    const mentorUser = await pool.query<{ id: string }>(`INSERT INTO users (email, password_hash, first_name, last_name, phone, status) VALUES ('mentor@college.edu', $2, 'Aarav', 'Sharma', '+91-99999-00002', 'ACTIVE') ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [mentorHash])
    const studentUser = await pool.query<{ id: string }>(`INSERT INTO users (email, password_hash, first_name, last_name, phone, status) VALUES ('student@college.edu', $3, 'Meera', 'Nair', '+91-99999-00003', 'ACTIVE') ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [studentHash])

    const adminRoleId = roleMap.get('ADMIN') ?? (await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'ADMIN'")).rows[0].id
    const mentorRoleId = roleMap.get('MENTOR') ?? (await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'MENTOR'")).rows[0].id
    const studentRoleId = roleMap.get('STUDENT') ?? (await pool.query<{ id: string }>("SELECT id FROM roles WHERE name = 'STUDENT'")).rows[0].id

    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2), ($3, $4), ($5, $6) ON CONFLICT DO NOTHING', [adminUser.rows[0].id, adminRoleId, mentorUser.rows[0].id, mentorRoleId, studentUser.rows[0].id, studentRoleId])

    const adminFaculty = await pool.query<{ id: string }>(`INSERT INTO faculty (user_id, employee_id, department_id, designation, status) VALUES ($1, 'FAC-1001', $2, 'Senior Mentor', 'ACTIVE') ON CONFLICT (employee_id) DO UPDATE SET department_id = EXCLUDED.department_id RETURNING id`, [adminUser.rows[0].id, departmentId.rows[0].id])
    const mentorFaculty = await pool.query<{ id: string }>(`INSERT INTO faculty (user_id, employee_id, department_id, designation, status) VALUES ($1, 'FAC-1002', $2, 'Mentor', 'ACTIVE') ON CONFLICT (employee_id) DO UPDATE SET department_id = EXCLUDED.department_id RETURNING id`, [mentorUser.rows[0].id, departmentId.rows[0].id])

    const academicYearRow = academicYearId.rows[0] ?? (await pool.query<{ id: string }>("SELECT id FROM academic_years WHERE label = '2026-2027'")).rows[0]
    const semesterRow = semesterId.rows[0] ?? (await pool.query<{ id: string }>("SELECT id FROM semesters WHERE academic_year_id = $1 AND sequence_no = 1", [academicYearRow.id])).rows[0]

    const studentRow = await pool.query<{ id: string }>(`INSERT INTO students (user_id, student_register_number, department_id, program_id, academic_year_id, semester_id, admission_year, status) VALUES ($1, 'CS-2026-001', $2, $3, $4, $5, 2026, 'ACTIVE') ON CONFLICT (student_register_number) DO UPDATE SET department_id = EXCLUDED.department_id RETURNING id`, [studentUser.rows[0].id, departmentId.rows[0].id, programId.rows[0].id, academicYearRow.id, semesterRow.id])

    await pool.query(`INSERT INTO mentor_assignments (mentor_id, student_id, assigned_by, effective_from, status) VALUES ($1, $2, $3, now(), 'ACTIVE') ON CONFLICT (student_id) WHERE status = 'ACTIVE' DO NOTHING`, [adminFaculty.rows[0].id, studentRow.rows[0].id, adminUser.rows[0].id])

    console.log('Seed data created for admin, mentor, and student roles.')
  } finally {
    await pool.end()
  }
}

async function main() {
  try {
    await ensureDatabaseAndRole()
    await applyMigrations()
    await seedData()
    console.log('Development bootstrap complete. Use admin@college.edu / Admin@123 to sign in.')
  } catch (error) {
    console.error('Bootstrap failed:', error)
    process.exitCode = 1
  }
}

void main()
