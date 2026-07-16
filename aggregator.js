const fs = require('fs');

// Configuration
const API_KEY = process.env.GOOGLE_MAPS_API_KEY; 
const PLACE_ID = ChIJDxf9m3CRtocRq-j1QkyT64c; // <-- Replace this with your exact Google Place ID

async function updateStatus() {
    try {
        console.log("Starting multi-source aggregation...");
        
        let openScore = 0;
        let closedScore = 0;
        let googleStatus = "UNAVAILABLE";

        // 1. PRIMARY INTELLIGENCE: Google Places API (New)
        if (API_KEY && PLACE_ID !== 'PLACE_ID_HERE') {
            console.log("Querying Google Places API (New)...");
            
            // The New API endpoint structure
            const googleUrl = `https://places.googleapis.com/v1/places/${PLACE_ID}`;
            
            // The New API requires headers instead of URL parameters
            const googleRes = await fetch(googleUrl, {
                headers: {
                    'X-Goog-Api-Key': API_KEY,
                    'X-Goog-FieldMask': 'businessStatus' // Explicitly requesting only the status field
                }
            });
            
            if (googleRes.ok) {
                const googleData = await googleRes.json();
                
                // The New API uses camelCase (businessStatus)
                if (googleData.businessStatus) {
                    googleStatus = googleData.businessStatus;
                    console.log(`Google Maps Status: ${googleStatus}`);
                    
                    // The Ultimate Override Logic
                    if (googleStatus === "OPERATIONAL") {
                        openScore += 1000; // Guaranteed to force an OPEN status
                    } else if (googleStatus === "CLOSED_TEMPORARILY") {
                        closedScore += 50; // Heavy weighting toward CLOSED
                    }
                }
            } else {
                console.warn(`Google API failed with status: ${googleRes.status}`);
            }
        } else {
            console.log("Skipping Google API: Missing Key or Place ID.");
        }

        // 2. SECONDARY INTELLIGENCE: Local Tulsa RSS Feeds
        console.log("Scanning local news RSS feeds...");
        const rssFeeds = [
            'https://www.newson6.com/arc/outboundfeeds/rss/?sort=display_date:desc', 
            'https://ktul.com/news/local/rss'
        ];

        const openKeywords = ['open', 'eating there', 'line', 'inside', 'finally', 'reopened', 'went today', 'grand opening'];
        const closedKeywords = ['closed', 'remodeling', 'fences', 'construction', 'not yet', 'soon', 'waiting', 'fenced'];

        for (const feed of rssFeeds) {
            try {
                const feedRes = await fetch(feed, {
                    headers: { 'User-Agent': 'BraumsAggregatorBot/1.0 (GitHub Actions)' }
                });
                
                if (feedRes.ok) {
                    const xmlText = await feedRes.text();
                    
                    // Simple regex to isolate titles and descriptions from the XML feed
                    const contentMatches = xmlText.match(/<(title|description)>(.*?)<\/\1>/gi) || [];
                    
                    contentMatches.forEach(tag => {
                        const lowerTag = tag.toLowerCase();
                        
                        // Only score articles specifically mentioning Braum's and the 101st street area
                        if ((lowerTag.includes("braum's") || lowerTag.includes("braums")) && 
                            (lowerTag.includes("101") || lowerTag.includes("101st"))) {
                            
                            openKeywords.forEach(keyword => {
                                if (lowerTag.includes(keyword)) openScore += 1;
                            });
                            
                            closedKeywords.forEach(keyword => {
                                if (lowerTag.includes(keyword)) closedScore += 1;
                            });
                        }
                    });
                }
            } catch (rssError) {
                console.error(`Failed to parse feed ${feed}:`, rssError.message);
            }
        }

        // 3. FINAL LOGIC EVALUATION
        let status = "UNKNOWN";
        if (openScore === 0 && closedScore === 0) {
            status = "UNKNOWN"; 
        } else if (openScore > closedScore) {
            status = "OPEN";
        } else if (closedScore > openScore) {
            status = "CLOSED";
        } else {
            status = "OPENING SOON"; 
        }
        
        const output = { 
            status: status, 
            confidence: { openScore, closedScore, googleStatus },
            lastChecked: new Date().toISOString()
        };

        fs.writeFileSync('status.json', JSON.stringify(output, null, 2));
        console.log("Successfully wrote status.json:", output);
        
    } catch (error) {
        console.error("Error during aggregation process:", error);
        const errorOutput = { status: "ERROR", error: error.message };
        fs.writeFileSync('status.json', JSON.stringify(errorOutput, null, 2));
    }
}

updateStatus();
