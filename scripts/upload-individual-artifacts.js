const fs = require('fs');
const path = require('path');

async function uploadIndividualArtifacts() {
  console.log('====================================================');
  console.log(' Scanning dist/ for individual artifacts to upload');
  console.log('====================================================');

  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.warn(`[WARN] dist directory not found at: ${distDir}`);
    return;
  }

  const validExtensions = [
    '.dmg',
    '.zip',
    '.msi',
    '.exe',
    '.AppImage',
    '.deb',
    '.rpm',
    '.pacman',
    '.snap',
    '.tar.gz'
  ];

  const allEntries = fs.readdirSync(distDir);
  const targetFiles = allEntries.filter(file => {
    const fullPath = path.join(distDir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return false;
      return validExtensions.some(ext => file.toLowerCase().endsWith(ext.toLowerCase()));
    } catch {
      return false;
    }
  });

  if (targetFiles.length === 0) {
    console.log('[INFO] No installer/package files found in dist/ to upload.');
    return;
  }

  console.log(`[INFO] Found ${targetFiles.length} file(s) for individual artifact upload:`);
  targetFiles.forEach((file, index) => {
    const fullPath = path.join(distDir, file);
    const sizeMB = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2);
    console.log(`  ${index + 1}. ${file} (${sizeMB} MB)`);
  });

  // Attempt upload using @actions/artifact if running in GitHub Actions environment
  let artifactClient = null;
  try {
    const { DefaultArtifactClient } = require('@actions/artifact');
    artifactClient = new DefaultArtifactClient();
  } catch (err) {
    console.log('[INFO] @actions/artifact module not loaded or not in Actions environment:', err.message);
  }

  if (artifactClient && process.env.GITHUB_ACTIONS) {
    for (const file of targetFiles) {
      const fullPath = path.join(distDir, file);
      // Clean up artifact name for GitHub Actions naming constraints
      const artifactName = file.replace(/[^a-zA-Z0-9._-]/g, '_');
      console.log(`\n-> Uploading single artifact: "${artifactName}" from ${file}...`);
      try {
        const response = await artifactClient.uploadArtifact(
          artifactName,
          [fullPath],
          distDir,
          { retentionDays: 30 }
        );
        console.log(`✓ Successfully uploaded artifact: "${artifactName}" (ID: ${response.id || 'OK'})`);
      } catch (uploadErr) {
        console.error(`✗ Failed to upload artifact "${artifactName}":`, uploadErr.message);
      }
    }
  } else {
    console.log('[INFO] Artifact client not active. Files verified and available in dist/.');
  }

  console.log('\n✓ Artifact scanning & individual upload process completed.');
}

uploadIndividualArtifacts().catch(err => {
  console.error('[ERROR] Unexpected error in uploadIndividualArtifacts:', err);
  process.exit(1);
});
