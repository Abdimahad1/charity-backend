const Slide = require('../models/Slide');

function toUploadsPath(v) {
  if (!v) return v;
  const s = String(v);
  const m = s.match(/\/uploads\/[^\s"'?]+/);
  if (m) return m[0];
  const noOrigin = s.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  if (noOrigin.startsWith('uploads/')) return `/${noOrigin}`;
  if (noOrigin.startsWith('images/')) return `/uploads/${noOrigin}`;
  return `/uploads/images/${noOrigin}`;
}

/** GET /api/slides */
exports.listSlides = async (req, res, next) => {
  try {
    const { q = '', published, limit = 100 } = req.query;
    const filter = {};
    if (q) {
      const rx = new RegExp(q, 'i');
      filter.$or = [{ title: rx }, { subtitle: rx }, { alt: rx }];
    }
    if (published === 'true') filter.published = true;
    if (published === 'false') filter.published = false;

    const items = await Slide.find(filter)
      .sort({ position: -1, createdAt: -1 })
      .limit(Number(limit));
    res.json({ items, total: items.length });
  } catch (err) { next(err); }
};

/** GET /api/slides/:id */
exports.getSlide = async (req, res, next) => {
  try {
    const item = await Slide.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Slide not found' });
    res.json(item);
  } catch (err) { next(err); }
};

/** POST /api/slides */
exports.createSlide = async (req, res, next) => {
  try {
    const payload = sanitize(req.body);
    if (!payload.src) return res.status(400).json({ message: 'Image src required' });
    const created = await Slide.create(payload);
    res.status(201).json(created);
  } catch (err) { next(err); }
};

/** PUT /api/slides/:id */
exports.updateSlide = async (req, res, next) => {
  try {
    const payload = sanitize(req.body);
    const updated = await Slide.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Slide not found' });
    res.json(updated);
  } catch (err) { next(err); }
};

/** DELETE /api/slides/:id */
exports.deleteSlide = async (req, res, next) => {
  try {
    const deleted = await Slide.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Slide not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

/** PATCH /api/slides/:id/move?dir=up|down */
exports.moveSlide = async (req, res, next) => {
  try {
    const { dir } = req.query;
    const s = await Slide.findById(req.params.id);
    if (!s) return res.status(404).json({ message: 'Slide not found' });

    const delta = dir === 'down' ? -1 : 1;
    s.position = (typeof s.position === 'number' ? s.position : Date.now()) + delta;
    await s.save();

    const items = await Slide.find({}).sort({ position: -1, createdAt: -1 });
    res.json({ items, total: items.length });
  } catch (err) { next(err); }
};

function sanitize(b = {}) {
  const x = {
    title: b.title,
    subtitle: b.subtitle,
    alt: b.alt,
    src: b.src ? toUploadsPath(b.src) : undefined,  // <-- normalize here
    align: b.align,
    overlay: num(b.overlay),
    published: bool(b.published),
    position: num(b.position),
  };
  Object.keys(x).forEach(k => x[k] === undefined && delete x[k]);
  return x;
}
const num = v => (v === '' || v === undefined || v === null ? undefined : Number(v));
const bool = v => (v === '' || v === undefined || v === null ? undefined : (v === true || v === 'true'));
