require('dotenv').config()
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const Multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const bodyParser = require('body-parser');
const Pdf_data = require('./models/pdf_data')
const pdf = require('pdf-parse');
const path = require('path');
const PDFJS = require('pdfjs-dist');
const pdfPoppler = require('pdf-poppler');
const stopword = require('stopword');
const auth = require('basic-auth');
const natural = require('natural');
const TfIdf = natural.TfIdf;


// Parse JSON request bodies
app.use(bodyParser.json());

// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));

// connect to mongoDB database
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

// Initialize Multer
const multer = Multer({
  storage: Multer.memoryStorage(),
});


// API to upload files to firebase and mongoDB
app.post('/upload', multer.array('files'), async (req, res) => {
  const files = req.files;

  // Loop through each uploaded file and upload it to firebase Storage
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = Date.now() + '-' + file.originalname; //give the file a unique name
    const fileBuffer = file.buffer;

    // Create a new blob in the bucket and upload the file data.
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    blobStream.on('error', (err) => {
      console.log(err);
      res.status(500).send({ message: 'Error uploading file.' });
    });

    blobStream.on('finish', async () => {
      // Parse the PDF file
      const data = await pdf(fileBuffer);
      const lines = [];
      data.text.split('\n').forEach(line => {
        lines.push(line);
      });

      // Drop empty lines from the list
      const nonEmptyLines = lines.filter(line => line.trim() !== '');
      const fileSizeInKB = file.size / 1024; // get file size in KB

      // Create a new Pdf_data instance with the filename, current date, and lines
      const pdfData = new Pdf_data({
        fileName: fileName,
        createdAt: new Date(),
        pages_number: data.numpages,
        sentences: nonEmptyLines,
        size: fileSizeInKB.toFixed(2),
      });

      // Save the Pdf_data instance to the database
      await pdfData.save();
    });

    blobStream.end(fileBuffer);
  }

  res.status(200).send(`${files.length} files uploaded successfully.`);
});

// API to show all files information from MongoDB
app.get('/showFiles', requireAuth, async (req, res) => {
  try {
    const pdfData = await Pdf_data.find({}, '-sentences');
    res.json(pdfData);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the data.");
  }
});

// API to show one file information from mongoodb with a given id
app.get('/showFiles/:id', requireAuth,getParams, async (req, res) => {
  try {
    const file = res.file
    const pdfData = await Pdf_data.find(file, '-sentences');
    res.status(200).json(pdfData);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the data.");
  }
});

// API to Retrieve a stored PDF given the ID
app.get('/showPdf/:id',requireAuth, getParams,async (req, res) => {
  try {
    const name = res.file.fileName;
    const [files] = await bucket.getFiles();

    // Find the file with the given name
    const file = files.find(file => file.name === name);

    if (!file) {
      // Return a 404 response if the file is not found
      return res.status(404).send('File not found.');
    }

    // Get a readable stream for the file and pipe it to the response
    const stream = file.createReadStream();
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while retrieving the file.');
  }
});

// API to Retrieve an image of a specific page from a pdf file
app.get('/showPdfImg/:id/:pageNumber',requireAuth, getParams, async (req, res) => {
  try {
    // 1. Save the file locally
    const name = res.file.fileName;
    const page_number = req.params.pageNumber; // Use req.params instead of res.params
    const [files] = await bucket.getFiles();

    // Find the file with the given name
    const file = files.find(file => file.name === name);

    if (!file) {
      // Return a 404 response if the file is not found
      return res.status(404).send('File not found.');
    }

    // Get a readable stream for the file
    const stream = file.createReadStream();

    // Create a writable stream to save the file locally
    const localFilePath = `./models/${name}`;
    const writeStream = fs.createWriteStream(localFilePath);

    // Pipe the file data to the writable stream
    stream.pipe(writeStream);

    // Wait for the file to be saved locally
    writeStream.on('finish', async () => {
      // 2. Convert PDF to image
      const pdfPath = localFilePath;
      const outputPath = 'models';
      const options = {
        format: 'jpg',
        out_dir: outputPath,
        out_prefix: 'image',
        page: page_number, // the page number you want to convert
      };

      try {
        await pdfPoppler.convert(pdfPath, options);

        // 3. Send the image as a response
        const imageName = `image-${page_number}.jpg`; // Use the correct image name based on page number
        const imagePath = path.join(__dirname, 'models', imageName);

        // Check if the image file exists
        fs.access(imagePath, fs.constants.F_OK, (err) => {
          if (err) {
            console.error(`Image not found: ${imagePath}`);
            return res.status(404).send('Image not found.');
          }

          // Read the image file and send it as a response
          const imageStream = fs.createReadStream(imagePath);
          imageStream.pipe(res);

          // 4. Delete the PDF and image files after the response is sent
          imageStream.on('end', () => {
            fs.unlinkSync(pdfPath);
            fs.unlinkSync(imagePath);
          });
        });
      } catch (error) {
        //res.status(500).send(error);
        res.status(500).send('File Page does not exist');
      }
    });

    writeStream.on('error', (err) => {
      console.error(err);
      res.status(500).send('An error occurred while saving the file locally.');
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while retrieving the file.');
  }
});

// API to Search for the existence of a certain keyword in all stored PDF's
app.get('/showFilesByWord/:word',requireAuth, async (req, res) => {
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
    res.status(200).json(matchingData);
  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the PDF data.");
  }

});

// API to Return all the parsed sentences for a given PDF ID
app.get('/showFileSentences/:id',requireAuth , getParams, (req, res) => {
  res.status(200).send(res.file.sentences)
})

//Check the occurrence of a word in PDF. Give the total number of times the word is found, in addition to all the sentences the word is found in
app.get('/searchForWord/:id/:word',requireAuth, async (req, res) => {
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


//Give the top 5 occurring words in a PDF
app.get('/topwords/:id', requireAuth, getParams, async (req, res) => {
  try {
    const content = res.file.sentences;

    // Tokenize the PDF content and extract all the words
    const tokenizer = new natural.WordTokenizer();
    const words = tokenizer.tokenize(content.join(' '));

    // Filter out stop words
    const filteredWords = stopword.removeStopwords(words, stopword.words);

    // Count the occurrence of each word and store it in a map
    const wordMap = new Map();
    filteredWords.forEach((word) => {
      const count = (wordMap.get(word) || 0) + 1;
      wordMap.set(word, count);
    });

    // Sort the map by the occurrence count in descending order
    const sortedWords = [...wordMap.entries()].sort((a, b) => b[1] - a[1]);

    // Return the top 5 words with the highest occurrence count
    const topWords = sortedWords.slice(0, 5).map(([word, count]) => ({ word, count }));

    res.status(200).json({ topWords });
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while getting the top words.');
  }
});

// Retern relevant Document for a query
app.get('/showRelevantFiles/:query', requireAuth, async (req, res) => {
  try {
    let documents = []
    let document_ids = []
    const pdfData = await Pdf_data.find({});
    for (let i = 0; i < pdfData.length; i++) {
      se = pdfData[i].sentences.join(' ')
      documents.push(se)
      document_ids.push(pdfData[i]._id)
    }

    const tfidf = new TfIdf();
    documents.forEach(document => {
      tfidf.addDocument(document);
    });

    const query = req.params.query;

    const scores = [];
    tfidf.tfidfs(query, (index, score) => {
      if (score > 0) {
        scores.push({ document_id: document_ids[index], score });
      }
    });

    scores.sort((a, b) => b.score - a.score);

    // Assign rank to each score
    for (let i = 0; i < scores.length; i++) {
      scores[i].rank = i + 1;
    }

    res.status(200).json(scores);

  } catch (err) {
    console.error(err);
    res.status(500).send("An error occurred while retrieving the data.");
  }
});


//	Delete a PDF file and all its related data (given only the PDF ID)
app.delete('/deleteFile/:id',requireAuth, getParams, async (req, res) => {
  try {

    // Delete the PDF data from MongoDB
    await Pdf_data.deleteOne(res.file);

    // Delete the file from Firebase
    const file = bucket.file(res.file.fileName);
    file.delete()
      .then(() => {
        console.log(`File ${res.file.fileName} deleted successfully.`);
      })
      .catch((err) => {
        console.error(`Error deleting file ${res.file.fileName}:`, err);
      });

    res.status(200).send('File deleted successfully.');
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while deleting the file.');
  }
});

app.delete('/deleteFile',requireAuth, async (req, res) => {
  try {
    // Get all PDF data from MongoDB
    const pdfDataList = await Pdf_data.find();

    // Get all files from Firebase storage
    const [files] = await bucket.getFiles();

    let errors = [];

    // Delete files from MongoDB
    for (const pdfData of pdfDataList) {
      try {
        await Pdf_data.deleteOne({ _id: pdfData._id });
      } catch (err) {
        console.error(`Error deleting file from MongoDB (${pdfData.fileName}):`, err);
        errors.push(`Error deleting file from MongoDB (${pdfData.fileName}): ${err.message}`);
      }
    }

    // Delete files from Firebase storage
    for (const file of files) {
      try {
        await file.delete();
      } catch (err) {
        console.error(`Error deleting file from Firebase (${file.name}):`, err);
        errors.push(`Error deleting file from Firebase (${file.name}): ${err.message}`);
      }
    }

    if (errors.length > 0) {
      res.status(500).json({
        message: "Some errors occurred while deleting files.",
        errors: errors,
      });
    } else {
      res.status(200).send('All files deleted successfully.');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while deleting the files.');
  }
});


// a middleware function that detects the parameters of an API
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

//a middleware function to set a basic auth
function requireAuth(req, res, next) {
  const credentials = auth(req);
  if (!credentials || credentials.name !== 'admin' || credentials.pass !== 'admin') {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Enter your username and password."');
    res.end('Access denied');
  } else {
    next();
  }
  // const username = 'admin';
// const password = 'admin';
// const encodedCredentials = btoa(`${username}:${password}`);
// console.log(encodedCredentials); // "YWRtaW46YWRtaW4="
}






// Start the server
app.listen(3000, () => {
  console.log('Server listening on port 3000');
});

