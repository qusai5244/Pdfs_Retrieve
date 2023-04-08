const mongoose = require('mongoose');
const shortid = require('shortid');

const pdfSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: shortid.generate
  },

  fileName: String,
  createdAt: { type: Date, default: Date.now },

  pages_number: Number,

  sentences: [String],

  size: Number
});

module.exports = mongoose.model('pdf_data', pdfSchema);

