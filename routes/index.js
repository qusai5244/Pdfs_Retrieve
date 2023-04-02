const express = require('express')
const router = express.Router()

// main page view
router.get('/', (req,res) =>{
    res.render('index', { title: 'ee' });
})

module.exports = router