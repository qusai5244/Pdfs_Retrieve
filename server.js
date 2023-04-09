require('dotenv').config()
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const upload = multer();
const bodyParser = require('body-parser');
const Pdf_data = require('./models/pdf_data')
const pdf = require('pdf-parse');

// Parse JSON request bodies
app.use(bodyParser.json());

// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// connect to database
var mongoDB = process.env.PDF_DATABASE_URL;
mongoose.Promise = global.Promise;

mongoose.connect(mongoDB , {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

var db = mongoose.connection;
//Bind connection to error event (to get notification of connection errors)
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('Successfully connected to MongoDB database at ' + mongoDB);
});


// Initialize Firebase Storage
const storage = new Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.KEY_File_Name,
});
const bucket = storage.bucket(process.env.BUCKET);


// pdfs files
const folderPath = './pdf_folder';

app.post('/addFiles', async (req, res) => {
  try {
    // Get a list of all the PDF files in the folder
    const files = await fs.promises.readdir(folderPath);
    const filesCount = files.length;
    let filesProcessed = 0;

    // Loop through each file in the folder and upload it
    files.forEach(async (file) => {
      const filePath = `${folderPath}/${file}`;
      const fileContent = await fs.promises.readFile(filePath);
      const filename = `${file}`;

      // Create a write stream to upload the file
      const storageFile = bucket.file(filename);
      const stream = storageFile.createWriteStream({
        metadata: {
          contentType: 'application/pdf',
        },
      });

      // Handle successful upload
      stream.on('finish', () => {
        // Parse the PDF file
        pdf(fileContent).then(function(data) {
          const lines = [];
          data.text.split('\n').forEach(line => {
            lines.push(line);
          });

          // Drop empty lines from the list
          const nonEmptyLines = lines.filter(line => line.trim() !== '');
          const stats = fs.statSync(filePath);
          const fileSizeInKB = stats.size / 1024;

          // Create a new Pdf_data instance with the filename, current date, and lines
          const pdfData = new Pdf_data({
            fileName: filename,
            createdAt: new Date(),
            pages_number: data.numpages,
            sentences: nonEmptyLines,
            size :fileSizeInKB.toFixed(2)
          });

          // Save the Pdf_data instance to the database
          pdfData.save();

          // Increment the number of files processed and check if all files have been processed
          filesProcessed++;
          if (filesProcessed === filesCount) {
            // Send a response indicating that all files have been uploaded
            res.status(200).send(`${filesCount} files uploaded successfully.`);
          }
        });
      });

      // Pipe the file data to the write stream
      stream.end(fileContent);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while uploading the files.");
  }
});

app.get('/showFiles/:word', async (req, res) => {
  try {
    const word = req.params.word;
    // Use the Pdf_data model to find all PDF data in the database
    const pdfData = await Pdf_data.find();
    const matchingData = {};

    for (let i = 0; i < pdfData.length; i++) {
      const sentences = pdfData[i].sentences;
      const matchingSentences = [];
      for (let j = 0; j < sentences.length; j++) {
        const sentence = sentences[j];
        // Check if the sentence contains the word (ignoring case)
        if (sentence.toLowerCase().includes(word.toLowerCase())) {
          matchingSentences.push(sentence);
        }
      }
      // If there are any matching sentences, add them to the matchingData object
      if (matchingSentences.length > 0) {
        matchingData[pdfData[i]._id] = matchingSentences;
      }
    }

    // Return the matching PDF data as a JSON response
    res.json(matchingData);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the PDF data.");
  }

});

app.get('/showFiles', async (req,res) => {
  try {
    const pdfData = await Pdf_data.find();
    res.json(pdfData);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the data.");
  }
})


app.get('/showFileSentences/:id' , getFile, (req, res) => {
  res.send(res.file.sentences)
})



//a middleware function that detects the parameters of an API
async function getFile(req, res, next) {
  let file
  try {
    file = await Pdf_data.findById(req.params.id)
    if (file == null) {
      return res.status(404).json({ message: 'Cannot find subscriber' })
    }
  } catch (err) {
    return next(err)
  }

  res.file = file
  next()
}

// Start the server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
