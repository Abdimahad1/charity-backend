const Event = require('../models/Event');
const { normalizeImage } = require('../utils/normalizeImage');

// ADMIN: GET /api/events
exports.listEvents = async (_req, res, next) => {
  try {
    const events = await Event.find({})
      .sort({ date: -1, position: 1, createdAt: -1 })
      .lean();
    res.json(events);
  } catch (err) { next(err); }
};

// ADMIN: GET /api/events/:id
exports.getEvent = async (req, res, next) => {
  try {
    const ev = await Event.findById(req.params.id).lean();
    if (!ev) return res.status(404).json({ message: 'Event not found' });
    res.json(ev);
  } catch (err) { next(err); }
};

// PUBLIC: GET /api/events/public?limit=6
exports.getPublicEvents = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '6', 10), 50);
    const q = { published: true };
    const events = await Event.find(q)
      .sort({ date: -1, position: 1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(events);
  } catch (err) { next(err); }
};

// ADMIN: POST /api/events
exports.createEvent = async (req, res, next) => {
  try {
    const body = sanitize(req.body);
    const ev = await Event.create(body);
    res.status(201).json(ev);
  } catch (err) { next(err); }
};

// ADMIN: PUT /api/events/:id
exports.updateEvent = async (req, res, next) => {
  try {
    const updates = sanitize(req.body);
    const ev = await Event.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).lean();
    if (!ev) return res.status(404).json({ message: 'Event not found' });
    res.json(ev);
  } catch (err) { next(err); }
};

// ADMIN: DELETE /api/events/:id
exports.deleteEvent = async (req, res, next) => {
  try {
    const ev = await Event.findByIdAndDelete(req.params.id).lean();
    if (!ev) return res.status(404).json({ message: 'Event not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ADMIN: PATCH /api/events/:id/publish
exports.togglePublish = async (req, res, next) => {
  try {
    const { published } = req.body;
    const ev = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: { published: !!published } },
      { new: true }
    ).lean();
    if (!ev) return res.status(404).json({ message: 'Event not found' });
    res.json(ev);
  } catch (err) { next(err); }
};

function sanitize(b = {}) {
  const x = {
    title: b.title?.trim(),
    description: b.description?.trim(),
    date: b.date ? new Date(b.date) : undefined,
    location: b.location?.trim(),
    coverImage: b.coverImage != null ? normalizeImage(b.coverImage) : undefined, // <-- here
    tags: Array.isArray(b.tags) ? b.tags.map(t => String(t).trim()).filter(Boolean) : undefined,
    featured: toBool(b.featured),
    published: toBool(b.published),
    position: toNum(b.position),
    slug: b.slug?.trim(),
  };
  Object.keys(x).forEach(k => x[k] === undefined && delete x[k]);
  return x;
}

const toNum = v => (v === '' || v === undefined || v === null ? undefined : Number(v));
const toBool = v => (v === '' || v === undefined || v === null ? undefined : (v === true || v === 'true'));
