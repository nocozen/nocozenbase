import { defineConfig } from 'tsup'
import fs from 'fs';
import path from 'path';
// import pkg from 'javascript-obfuscator';
// const { obfuscate } = pkg;
// import bytenode from 'bytenode';
import { execSync } from 'child_process';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  target: 'node20',
  format: ['cjs'], 
  dts: false,         
  sourcemap: false,
  minify: true,      
  clean: false,
  bundle: true,      
  splitting: false,
  shims: true,        
  // external: ['uWebSockets.js'],
  noExternal: [
    // '@dotenvx/dotenvx', 
  ],

  loader: {
    '.env': 'text',
    '.pem': 'text',
    '.html': 'text',
    '.ejs': 'text',
  },

  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'production'}"`,
  },

  onSuccess: async () => {
    try {
      execSync('ncc build src/server.ts -o dist --no-source-map-register --no-cache --minify', { stdio: 'inherit' });
      console.log('✅ ncc打包完成!');
      console.log('✅ 编译完成!');
    } catch (e: any) {
      console.log('❌ 打包过程出错：' + e);
    } finally {
      console.log('✅ 已删除*.js文件');

      const uwsName = 'uws_' + process.platform + '_' + process.arch + '_' + process.versions.modules + '.node';
      fs.copyFileSync(path.join('node_modules/uWebSockets.js/', uwsName), path.join('dist', uwsName));
      console.log(`✅ 已复制${uwsName}`);
      const inputPath = path.join('dist', 'server.js');
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

    }
    fs.copyFileSync('.env.production', path.join('dist', '.env'));
    fs.copyFileSync('run/run.bat', path.join('dist', 'run.bat'));
    fs.copyFileSync('run/run.sh', path.join('dist', 'run.sh'));
  },
})