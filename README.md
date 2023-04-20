
## API Reference

- All APIs are protected with a basic auth, so before testing any api make sure to include this in the header
| Key | Value     |
| :-------- | :------- |
| `Authorization` | `Basic YWRtaW46YWRtaW4` |

- To be able to upload pdf files via postman make sure to include this in the header as well
| Key | Value     |
| :-------- | :------- |
| `Content-Type` | `multipart/form-data` |

#
Testing APIs
- Upload pdfs

```http
  POST /upload
```

Select the "form-data" option in the body, include the specified item, and make sure that the value type is set to "File".
| Key | Value     |
| :-------- | :------- |
| `files` | `select files` |

- Get all pdfs data

```http
  GET /showFiles
```
- Get a pdf data with a given id

```http
  GET /showFiles/:id
```

- Get an image of a specific page from a pdf file

```http
  GET /showPdfImg/:id/:pageNumber
```

- Search for the existence of a certain keyword in all stored PDF's
```http
  GET /showFilesByWord/:word
```

- Get all the parsed sentences for a given PDF ID
```http
  GET /showFileSentences/:id
```

- Check the occurrence of a word in PDF file
```http
  GET /searchForWord/:id/:word
```

- Get the top 5 occurring words in a PDF
```http
  GET /topwords/:id
```

- Get the relevant Document for a query in ranks using TFIDF method
```http
  GET /showRelevantFiles/:query
```

- Delete a PDF file and all its related data with a given id
```http
  DELETE /deleteFile/:id
```

- Delete all PDFs files and all its related data
```http
  DELETE /deleteFile
```


