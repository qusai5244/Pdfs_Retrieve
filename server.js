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
const path = require('path');

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


app.post('/addFiles', async (req, res) => {
  try {
    // Get a list of all the PDF files in the folder
    const folderPath = 'pdf_folder';
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

app.get('/showFiles', async (req,res) => {
  try {
    const pdfData = await Pdf_data.find();
    res.json(pdfData);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the data.");
  }
})

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
        // Split the sentence into words using a regular expression
        const words = sentence.split(/\b\W+\b/);
        // Check if the word is in the sentence (ignoring case)
        if (words.some(w => w.toLowerCase() === word.toLowerCase())) {
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


app.get('/showFileSentences/:id' , getParams, (req, res) => {
  res.send(res.file.sentences)
})

//Check the occurrence of a word in PDF. Give the total number of times the word is found, in addition to all the sentences the word is found in
app.get('/search/:id/:word', async (req, res) => {
  try {
    const word = req.params.word;
    let totalOccurrence = 0;

    // Loop through all saved PDF files
    const file = await Pdf_data.findById(req.params.id);
    const sentences = file.sentences;
    let count = 0;
    const occurrences = [];

    // Loop through each sentence in the PDF file and search for the given word
    for (const sentence of sentences) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi'); // match whole words only
      if (sentence.match(regex)) {
        count++;
        occurrences.push(sentence);
      }
    }

    // If the word was found in the PDF file, add it to the result array
    if (count > 0) {
      totalOccurrence += count;
    }

    // Return the result to the client
    res.status(200).send({
      totalOccurrence: totalOccurrence,
      occurrences: occurrences,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while searching for the word.');
  }
});

const stopword = require('stopword');

//Give the top 5 occurring words in a PDF – try to make sure that these words are relevant, so filtering out stop words may be a good idea (e.g. the, it, and, is, or, but)
app.get('/topwords/:id', getParams, async (req, res) => {
  try {
    const content = res.file.sentences;

    // Parse the PDF content and extract all the words
    const words = content.join(' ').split(/[\s.,;]+/);

    // Filter out stop words
    const filteredWords = stopword.removeStopwords(words, stopword.eng);

    // Count the occurrence of each word and store it in a map
    const wordMap = new Map();
    filteredWords.forEach(word => {
      const count = wordMap.get(word) || 0;
      wordMap.set(word, count + 1);
    });

    // Sort the map by the occurrence count in descending order
    const sortedWords = [...wordMap].sort((a, b) => b[1] - a[1]);

    // Return the top 5 words with the highest occurrence count
    const topWords = sortedWords.slice(0, 5).map(([word, count]) => ({ word, count }));

    res.status(200).json({ topWords });
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while getting the top words.');
  }
});




//a middleware function that detects the parameters of an API
async function getParams(req, res, next) {
  let file
  try {
    file = await Pdf_data.findById(req.params.id)
    if (file == null) {
      return res.status(404).json({ message: 'Cannot find file' })
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
