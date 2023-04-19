PDF File Management API
This is a Node.js-based REST API that allows users to upload PDF files, extract text from PDFs, search for specific words, and delete files from Firebase Storage and MongoDB.

When a user uploads a PDF file, the API parses the text from the file and saves it to a MongoDB database along with metadata such as the file name, date uploaded, and file size. The API also uploads the PDF file to Firebase Storage for future retrieval.

The API provides several endpoints for retrieving information about uploaded files and for performing searches on the stored PDF text. Users can retrieve all stored files' information or retrieve the information and the sentences of a specific file using its ID. They can also retrieve a specific page from a PDF file as an image, search for a word's existence in all stored PDFs and give its total number of occurrences, get the top 5 occurring words in a PDF, and delete a file given its ID.

To run the API, the user must first install the required packages using the 'npm install' command. They must also set the required environment variables in a .'env' file, including the MongoDB database URL, Firebase Storage details, and project ID. Once everything is set up, the user can run the API using the 'npm run devstart' command. The API can be accessed on the localhost on port 3000, and the endpoints can be tested using a tool like Postman.
