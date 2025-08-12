const Charity = require('../models/Charity');

/** PUBLIC: GET /api/charities
 *  - Defaults to status=Published
 *  - Supports q, category, featured, page, limit
 */
exports.listCharitiesPublic = async (req, res, next) => {
  try {
    const {
      q = '',
      category,
      featured,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { status: 'Published' };

    if (q) {
      const rx = new RegExp(q, 'i');
      filter.$or = [{ title: rx }, { location: rx }, { excerpt: rx }];
    }
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (featured === 'false') filter.featured = false;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Charity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Charity.countDocuments(filter),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

/** ADMIN: GET /api/charities/admin
 *  - status=all|Draft|Published (default: all)
 *  - Supports q, category, featured, page, limit
 */
exports.listCharitiesAdmin = async (req, res, next) => {
  try {
    const {
      q = '',
      status = 'all',
      category,
      featured,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};
    if (q) {
      const rx = new RegExp(q, 'i');
      filter.$or = [{ title: rx }, { location: rx }, { excerpt: rx }];
    }
    if (status !== 'all') {
      // Normalize and validate
      const allowed = ['Draft', 'Published'];
      const normalized =
        status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      if (!allowed.includes(normalized)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      filter.status = normalized;
    }
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (featured === 'false') filter.featured = false;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Charity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Charity.countDocuments(filter),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

/** GET /api/charities/:id (public: allows viewing only Published; admins can use /admin/:id) */
exports.getCharity = async (req, res, next) => {
  try {
    const item = await Charity.findOne({ _id: req.params.id, status: 'Published' });
    if (!item) return res.status(404).json({ message: 'Charity not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

/** ADMIN: GET /api/charities/admin/:id (no status restriction) */
exports.getCharityAdmin = async (req, res, next) => {
  try {
    const item = await Charity.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Charity not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
};

/** POST /api/charities (admin) */
exports.createCharity = async (req, res, next) => {
  try {
    const payload = sanitize(req.body);
    const created = await Charity.create(payload);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/charities/:id (admin) */
exports.updateCharity = async (req, res, next) => {
  try {
    const payload = sanitize(req.body);
    const updated = await Charity.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Charity not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/** DELETE /api/charities/:id (admin) */
exports.deleteCharity = async (req, res, next) => {
  try {
    const deleted = await Charity.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Charity not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** helper: enforce numeric types & safe fields */
function sanitize(body) {
  const safe = {
    title: body.title,
    excerpt: body.excerpt,
    category: body.category,
    location: body.location,
    goal: num(body.goal),
    raised: num(body.raised),
    status: body.status, // 'Draft' | 'Published'
    cover: body.cover,
    donationLink: body.donationLink,
    featured: bool(body.featured),
  };
  Object.keys(safe).forEach((k) => safe[k] === undefined && delete safe[k]);
  return safe;
}

function num(v) {
  if (v === '' || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}
function bool(v) {
  if (v === '' || v === undefined || v === null) return undefined;
  return v === true || v === 'true';
}
