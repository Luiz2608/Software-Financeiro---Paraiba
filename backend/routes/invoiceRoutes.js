const express = require('express');
const multer = require('multer');
const path = require('path');
const { 
  processInvoice, 
  getHistoryList, 
  getHistoryDetail, 
  deleteHistory 
} = require('../controllers/invoiceController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'));
    }
  }
});

// Rotas existentes
router.post('/process', upload.single('pdfFile'), processInvoice);

// Novas rotas para histórico
router.get('/history', getHistoryList);
router.get('/history/:id', getHistoryDetail);
router.delete('/history/:id', deleteHistory);

module.exports = router;