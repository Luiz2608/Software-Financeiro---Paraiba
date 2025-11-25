const express = require('express');
const router = express.Router();
const pessoas = require('../controllers/pessoasController');

router.get('/', pessoas.listar);
router.post('/', pessoas.criar);
router.put('/:id', pessoas.atualizar);
router.delete('/:id', pessoas.excluirLogico);

module.exports = router;