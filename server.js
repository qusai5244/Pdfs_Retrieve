require('dotenv').config()
const express = require('express')
const app = express()
const mongoose = require('mongoose')


app.set('view engine', 'ejs');

// setup mongodb database
mongoose.connect(process.env.DATABASE_URL , {useNewUrlParser: true,
useUnifiedTopology: true})

const db = mongoose.connection
db.on('error' , (error) => console.log(error))
db.once('open' , () => console.log('Connected to Database'))


app.use(express.json())
//setup the routes
const indexRouter = require('./routes/index')
app.use('/', indexRouter);

app.listen(3000 , () => console.log('server Strarted at 3000'))