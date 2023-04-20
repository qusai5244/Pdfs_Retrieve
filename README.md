
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


