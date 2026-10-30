const express = require('express');
const router = express.Router();
const { getCars, getCarById, createCar, updateCar, deleteCar, changeCarStatus, subscribeCarAlert } = require('../controllers/carController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.get('/', getCars);
router.get('/:id', getCarById);
router.post('/', protect, admin, createCar);
router.put('/:id', protect, admin, updateCar);
router.delete('/:id', protect, admin, deleteCar);
router.patch('/:id/status', protect, admin, changeCarStatus);
router.post('/:id/notify', optionalProtect, subscribeCarAlert);

module.exports = router;

