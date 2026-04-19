const SupportTicket = require("../model/SupportTicket.model");

async function createTicket(req, res, next) {
  try {
    const { subject, description, category, priority } = req.body || {};
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: "subject and description are required." });
    }
    const ticket = await SupportTicket.create({
      userId: req.userId,
      subject,
      description,
      category: category || "other",
      priority: priority || "medium",
    });
    return res.status(201).json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTicket };
