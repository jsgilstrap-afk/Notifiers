const fs = require('fs');

async function updateStatus() {
    try {
        console.log("Fetching latest posts from r/Tulsa...");
        const query = encodeURIComponent("Braum's 101st OR Braums 2825 OR Braums 101");
        
        // Fetch directly using Node's native fetch API
        const response = await fetch(`https://www.reddit.com/r/tulsa/search.json?q=${query}&restrict_sr=on&sort=new`);
        const data = await response.json();
        
        let openScore = 0;
        let closedScore = 0;
        
        const openKeywords = ['open', 'eating there', 'line', 'inside', 'finally', 'reopened', 'went today', 'grand opening'];
        const closedKeywords = ['closed', 'remodeling', 'fences', 'construction', 'not yet', 'soon', 'waiting', 'fenced'];
        
        if (data.data && data.data.children) {
            data.data.children.forEach(post => {
                const text = (post.data.title + " " + post.data.selftext).toLowerCase();
                
                openKeywords.forEach(keyword => {
                    if (text.includes(keyword)) openScore += 1;
                });
                
                closedKeywords.forEach(keyword => {
                    if (text.includes(keyword)) closedScore += 1;
                });
            });
        }
        
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
            confidence: { openScore, closedScore },
            lastChecked: new Date().toISOString()
        };

        // Write the result directly to a static JSON file in the repository
        fs.writeFileSync('status.json', JSON.stringify(output, null, 2));
        console.log("Successfully wrote status.json:", output);
        
    } catch (error) {
        console.error("Error aggregating data:", error);
        const errorOutput = { status: "ERROR", error: error.message };
        fs.writeFileSync('status.json', JSON.stringify(errorOutput, null, 2));
    }
}

updateStatus();
