const express = require('express');
const router = express.Router();

const {
  listMovimentos,
  getMovimento,
  getParcelas,
  updateMovimento,
  createMovimento,
  deleteMovimento,
} = require('../controllers/contasController');

router.get('/movimentos', listMovimentos);
router.post('/movimentos', createMovimento);
router.get('/movimentos/:id', getMovimento);
router.get('/movimentos/:id/parcelas', getParcelas);
router.put('/movimentos/:id', updateMovimento);
router.delete('/movimentos/:id', deleteMovimento);

module.exports = router;