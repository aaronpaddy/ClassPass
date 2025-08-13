const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, 'public', 'models');

// Create models directory if it doesn't exist
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

const models = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_expression_model-weights_manifest.json',
    'face_expression_model-shard1'
];

// Try multiple sources for the models
const sources = [
    'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/',
    'https://raw.githubusercontent.com/face-api.js/face-api.js/master/weights/',
    'https://raw.githubusercontent.com/vladmandic/face-api/master/weights/'
];

function downloadFile(filename, sourceIndex = 0) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(modelsDir, filename);
        const url = sources[sourceIndex] + filename;
        
        console.log(`Downloading ${filename} from source ${sourceIndex + 1}...`);
        
        const file = fs.createWriteStream(filePath);
        
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    // Verify file size for large files
                    const stats = fs.statSync(filePath);
                    if (filename.includes('face_recognition_model-shard1') && stats.size < 4000000) {
                        console.log(`⚠️  ${filename} seems too small (${stats.size} bytes), trying next source...`);
                        fs.unlinkSync(filePath);
                        if (sourceIndex < sources.length - 1) {
                            downloadFile(filename, sourceIndex + 1).then(resolve).catch(reject);
                        } else {
                            reject(new Error(`Failed to download ${filename} from all sources`));
                        }
                    } else {
                        console.log(`✓ Downloaded ${filename} (${stats.size} bytes)`);
                        resolve();
                    }
                });
            } else {
                console.log(`Source ${sourceIndex + 1} failed for ${filename}: ${response.statusCode}`);
                if (sourceIndex < sources.length - 1) {
                    downloadFile(filename, sourceIndex + 1).then(resolve).catch(reject);
                } else {
                    reject(new Error(`Failed to download ${filename}: ${response.statusCode}`));
                }
            }
        }).on('error', (err) => {
            console.log(`Source ${sourceIndex + 1} error for ${filename}: ${err.message}`);
            if (sourceIndex < sources.length - 1) {
                downloadFile(filename, sourceIndex + 1).then(resolve).catch(reject);
            } else {
                reject(err);
            }
        });
    });
}

async function downloadAllModels() {
    console.log('Downloading face-api.js models...');
    
    try {
        for (const model of models) {
            await downloadFile(model);
        }
        console.log('All models downloaded successfully!');
        
        // Verify all files exist and have reasonable sizes
        console.log('\nVerifying downloaded files:');
        for (const model of models) {
            const filePath = path.join(modelsDir, model);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log(`✓ ${model}: ${stats.size} bytes`);
            } else {
                console.log(`❌ ${model}: File missing`);
            }
        }
    } catch (error) {
        console.error('Error downloading models:', error);
    }
}

downloadAllModels(); 