const Event = require('../models/Event');

// ADMIN: GET /api/events
exports.listEvents = async (req, res, next) => {
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
    // Expecting { title, description, date, location, coverImage, tags, featured, published, position, slug }
    const body = req.body || {};
    const ev = await Event.create(body);
    res.status(201).json(ev);
  } catch (err) { next(err); }
};

// ADMIN: PUT /api/events/:id
exports.updateEvent = async (req, res, next) => {
  try {
    const updates = req.body || {};
    const ev = await Event.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
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
