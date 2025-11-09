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

router.post('/process', upload.single('pdfFile'), processInvoice);

router.get('/history', getHistoryList);
router.get('/history/:id', getHistoryDetail);
router.delete('/history/:id', deleteHistory);

module.exports = router;