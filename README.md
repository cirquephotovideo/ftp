# FTP File Management Utility

This application provides a web interface for managing and automatically retrieving files from multiple FTP, SFTP, and HTTP sources. It maintains a history of the last three files retrieved from each source.

## Features

- Support for FTP, SFTP, and HTTP file sources
- Configurable check frequency for each source
- Automatic file retrieval based on configured schedules
- History tracking of the last 3 files from each source
- Clean web interface for managing sources and viewing history

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. Install server dependencies:
```bash
cd server
npm install
```

2. Install client dependencies:
```bash
cd client
npm install
```

### Running the Application

1. Start the server:
```bash
cd server
npm start
```

2. In a new terminal, start the client:
```bash
cd client
npm start
```

The application will be available at http://localhost:3000

## Usage

1. Add a new source:
   - Fill in the source details in the form (name, type, URL, credentials)
   - Set the check frequency in hours
   - Click "Add Supplier"

2. View source history:
   - Click "View History" on any source card to see the last 3 files retrieved

## File Storage

Retrieved files are stored in the `server/downloads` directory. The application automatically manages this directory, keeping only the last 3 files for each source.

## Security Notes

- Credentials are stored in a local SQLite database
- File transfers use secure protocols where available (SFTP)
- The application is designed for internal network use

## Troubleshooting

If you encounter issues:

1. Check the server logs for error messages
2. Verify source credentials and URLs
3. Ensure proper network access to sources
4. Check file permissions in the downloads directory

## Supported File Sources

The application supports the following types of sources:

### FTP
- Standard FTP connections
- Requires host, username, and password
- Example URL format: ftp://ftp.example.com

### SFTP
- Secure FTP over SSH
- Requires host, username, and password
- Example URL format: sftp://sftp.example.com

### HTTP/HTTPS
- Direct file downloads over HTTP/HTTPS
- Optional basic authentication
- Example URL format: https://example.com/files/latest.csv
