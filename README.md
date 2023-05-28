
# PDF Files Management REST APIs 
This is a Node.js-based REST API that allows users to upload PDF files, extract text from PDFs, search for specific words, and delete files from Firebase Storage and MongoDB.

When a user uploads a PDF file, the API parses the text from the file and saves it to a MongoDB database along with metadata such as the file name, date uploaded, and file size. The API also uploads the PDF file to Firebase Storage for future retrieval.

The API provides several endpoints for retrieving information about uploaded files and for performing searches on the stored PDF text. Users can retrieve all stored files' information or retrieve the information and the sentences of a specific file using its ID. They can also retrieve a specific page from a PDF file as an image, search for a word's existence in all stored PDFs and give its total number of occurrences, get the top 5 occurring words in a PDF, and delete a file given its ID.

## Setup
- Clone this project 
- Fill the required parameters for firebase storage in Firebase_Admin_SDK.json and .env files
- Inside the project root run

```bash
npm install
```
- Make sure you have your MongoDB service running on localhost
```bash
mongodb://127.0.0.1:27017
```

once these steps are completed 
- start the server by running
```bash
npm run devStart
```
- the server will then run on the localhost on port 3000
```bash
http://localhost:3000
```

## API Reference

- All APIs are protected with a basic auth, so before testing any api make sure to include this in the header.


| Key           | Value         |
| ------------- | ------------- |
| `Authorization`  | `Basic YWRtaW46YWRtaW4`  |

- To be able to upload pdf files via postman make sure to include this in the header as well.


| Key           | Value         |
| ------------- | ------------- |
| `Content`  | `multipart/form-data`  |


#
Testing APIs
- Upload pdfs

```
  POST /upload
```

Select the "form-data" option in the body, include the specified item, and make sure that the value type is set to "File".
| Key | Value     |
| :-------- | :------- |
| `files` | `select files` |

- Get all pdfs data

```
  GET /showFiles
```
- Get a pdf data with a given id

```
  GET /showFiles/:id
```
- Get a pdf file with a given id
```
  GET /showPdf/:id
```

- Get an image of a specific page from a pdf file

```
  GET /showPdfImg/:id/:pageNumber
```

- Search for the existence of a certain keyword in all stored PDF's
```
  GET /showFilesByWord/:word
```

- Get all the parsed sentences for a given PDF ID
```
  GET /showFileSentences/:id
```

- Check the occurrence of a word in PDF file
```
  GET /searchForWord/:id/:word
```

- Get the top 5 occurring words in a PDF
```
  GET /topwords/:id
```

- Get the relevant Document for a query in ranks using TFIDF method
```
  GET /showRelevantFiles/:query
```

- Delete a PDF file and all its related data with a given id
```
  DELETE /deleteFile/:id
```

- Delete all PDFs files and all its related data
```
  DELETE /deleteFile
```


