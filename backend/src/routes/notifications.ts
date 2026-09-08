import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const id = z.string().uuid()
router.get('/', requireAuth, async (request, response, next) => { try { const result = await pool.query('SELECT id, type, title, message, reference_type, reference_id, status, created_at, read_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [request.auth!.userId]); return response.json({ success: true, data: result.rows, message: 'Notifications loaded' }) } catch (error) { next(error) } })
router.patch('/:id/read', requireAuth, async (request, response, next) => { try { const notificationId = id.parse(request.params.id); const result = await pool.query('UPDATE notifications SET status = \'READ\', read_at = now() WHERE id = $1 AND user_id = $2 RETURNING id, status, read_at', [notificationId, request.auth!.userId]); if (!result.rowCount) return response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } }); return response.json({ success: true, data: result.rows[0], message: 'Notification marked read' }) } catch (error) { next(error) } })
router.patch('/read-all', requireAuth, async (request, response, next) => { try { await pool.query('UPDATE notifications SET status = \'READ\', read_at = COALESCE(read_at, now()) WHERE user_id = $1 AND status = \'UNREAD\'', [request.auth!.userId]); return response.json({ success: true, data: null, message: 'Notifications marked read' }) } catch (error) { next(error) } })
router.patch('/:id/archive', requireAuth, async (request, response, next) => { try { const notificationId = id.parse(request.params.id); const result = await pool.query('UPDATE notifications SET status = \'ARCHIVED\' WHERE id = $1 AND user_id = $2 RETURNING id, status', [notificationId, request.auth!.userId]); if (!result.rowCount) return response.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } }); return response.json({ success: true, data: result.rows[0], message: 'Notification archived' }) } catch (error) { next(error) } })
export default router
