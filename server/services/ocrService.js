const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const pdf2pic = require('pdf2pic');
const fs = require('fs');
const path = require('path');

class OCRService {
  
  /**
   * Extract text from image file using OCR
   */
  static async extractTextFromImage(imagePath) {
    try {
      console.log('🔍 Starting OCR extraction from image:', imagePath);
      
      // Preprocess image for better OCR accuracy
      const processedImagePath = await this.preprocessImage(imagePath);
      
      // Perform OCR
      const { data: { text } } = await Tesseract.recognize(processedImagePath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      // Clean up processed image if it's different from original
      if (processedImagePath !== imagePath) {
        fs.unlinkSync(processedImagePath);
      }
      
      console.log('✅ OCR extraction completed');
      return text;
      
    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      throw new Error('Failed to extract text from image: ' + error.message);
    }
  }
  
  /**
   * Convert PDF to images and extract text using OCR
   */
  static async extractTextFromPDF(pdfPath) {
    try {
      console.log('📄 Converting PDF to images for OCR:', pdfPath);
      
      const convert = pdf2pic.fromPath(pdfPath, {
        density: 300,           // Higher DPI for better OCR
        saveFilename: "page",
        savePath: path.dirname(pdfPath),
        format: "png",
        width: 2000,           // High resolution
        height: 2000
      });
      
      // Convert all pages to images
      const results = await convert.bulk(-1, { responseType: "image" });
      console.log(`📄 Converted ${results.length} pages to images`);
      
      let allText = '';
      
      // Process each page with OCR
      for (let i = 0; i < results.length; i++) {
        console.log(`🔍 Processing page ${i + 1}/${results.length} with OCR`);
        
        const imagePath = results[i].path;
        const pageText = await this.extractTextFromImage(imagePath);
        allText += `\n--- Page ${i + 1} ---\n${pageText}\n`;
        
        // Clean up temporary image
        fs.unlinkSync(imagePath);
      }
      
      console.log('✅ PDF OCR extraction completed');
      return allText;
      
    } catch (error) {
      console.error('❌ PDF OCR extraction failed:', error);
      throw new Error('Failed to extract text from PDF using OCR: ' + error.message);
    }
  }
  
  /**
   * Preprocess image for better OCR accuracy
   */
  static async preprocessImage(imagePath) {
    try {
      const processedPath = imagePath.replace(/\.(jpg|jpeg|png|gif)$/i, '_processed.png');
      
      await sharp(imagePath)
        .resize(2000, 2000, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .greyscale()                    // Convert to grayscale
        .normalize()                    // Normalize contrast
        .sharpen()                      // Sharpen text
        .threshold(128)                 // Convert to black and white
        .png()
        .toFile(processedPath);
      
      return processedPath;
      
    } catch (error) {
      console.log('⚠️ Image preprocessing failed, using original:', error.message);
      return imagePath;
    }
  }
  
  /**
   * Extract contacts from OCR text
   */
  static extractContactsFromText(text) {
    const contacts = [];
    
    // Phone number patterns (various formats)
    const phonePatterns = [
      /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g, // US format
      /(\+?91[-.\s]?)?([0-9]{10})/g,                                        // Indian format
      /(\+?44[-.\s]?)?([0-9]{11})/g,                                        // UK format
      /(\+?[0-9]{1,4}[-.\s]?)?([0-9]{6,14})/g                             // International
    ];
    
    // Name patterns (words that look like names)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    
    // Extract all phone numbers
    const phones = new Set();
    phonePatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        let phone = match[0].replace(/[-.\s()]/g, '');
        
        // Add country code if missing
        if (!phone.startsWith('+')) {
          if (phone.length === 10 && phone.match(/^[0-9]{10}$/)) {
            phone = '+1' + phone; // Assume US if 10 digits
          } else if (phone.length === 10 && phone.startsWith('9')) {
            phone = '+91' + phone; // Assume India if starts with 9
          } else if (phone.length >= 10) {
            phone = '+' + phone;
          }
        }
        
        if (phone.length >= 10) {
          phones.add(phone);
        }
      }
    });
    
    // Extract names near phone numbers
    const lines = text.split('\n');
    const phoneArray = Array.from(phones);
    
    phoneArray.forEach(phone => {
      let associatedName = '';
      
      // Find the line containing this phone number
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanPhone = phone.replace(/[+\-.\s()]/g, '');
        
        if (line.includes(cleanPhone) || line.includes(phone)) {
          // Look for names in the same line
          const nameMatches = line.match(namePattern);
          if (nameMatches && nameMatches.length > 0) {
            associatedName = nameMatches[0];
          }
          
          // If no name in same line, check previous and next lines
          if (!associatedName) {
            // Check previous line
            if (i > 0) {
              const prevLineNames = lines[i - 1].match(namePattern);
              if (prevLineNames && prevLineNames.length > 0) {
                associatedName = prevLineNames[0];
              }
            }
            
            // Check next line
            if (!associatedName && i < lines.length - 1) {
              const nextLineNames = lines[i + 1].match(namePattern);
              if (nextLineNames && nextLineNames.length > 0) {
                associatedName = nextLineNames[0];
              }
            }
          }
          
          break;
        }
      }
      
      contacts.push({
        contact_number: phone,
        name: associatedName || '',
        source: 'OCR'
      });
    });
    
    // If no phone numbers found, try to extract any names for manual review
    if (contacts.length === 0) {
      const allNames = text.match(namePattern) || [];
      const uniqueNames = [...new Set(allNames)];
      
      uniqueNames.slice(0, 10).forEach(name => { // Limit to 10 names
        contacts.push({
          contact_number: '',
          name: name,
          source: 'OCR_NAME_ONLY',
          note: 'Phone number not detected - please add manually'
        });
      });
    }
    
    return contacts;
  }
  
  /**
   * Extract business card information
   */
  static extractBusinessCardInfo(text) {
    const info = {
      name: '',
      phone: '',
      email: '',
      company: '',
      title: '',
      address: ''
    };
    
    // Email pattern
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) info.email = emailMatch[0];
    
    // Phone pattern
    const phoneMatch = text.match(/(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    if (phoneMatch) info.phone = phoneMatch[0];
    
    // Name pattern (usually first capitalized words)
    const nameMatch = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/);
    if (nameMatch) info.name = nameMatch[0];
    
    // Company patterns
    const companyPatterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Corp|Company|Co\.|Ltd|Limited)\b/,
      /\b[A-Z][A-Z\s&]+(?:Inc|LLC|Corp|Company|Co\.|Ltd|Limited)\b/
    ];
    
    for (const pattern of companyPatterns) {
      const match = text.match(pattern);
      if (match) {
        info.company = match[0];
        break;
      }
    }
    
    // Title patterns
    const titlePatterns = [
      /\b(?:CEO|CTO|CFO|President|Director|Manager|VP|Vice President|Senior|Lead|Head of)\b[^.\n]*/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        info.title = match[0].trim();
        break;
      }
    }
    
    return info;
  }
  
  /**
   * Determine if PDF contains images (scanned document)
   */
  static async isImageBasedPDF(pdfPath) {
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      // If text extraction yields very little text, it's likely image-based
      const textLength = data.text.trim().length;
      const pageCount = data.numpages;
      
      // Heuristic: if less than 50 characters per page, likely image-based
      const avgTextPerPage = textLength / pageCount;
      
      console.log(`📄 PDF Analysis: ${textLength} chars, ${pageCount} pages, ${avgTextPerPage.toFixed(1)} chars/page`);
      
      return avgTextPerPage < 50;
      
    } catch (error) {
      console.log('⚠️ Could not analyze PDF, assuming image-based');
      return true;
    }
  }
}

module.exports = OCRService;