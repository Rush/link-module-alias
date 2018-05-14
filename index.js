#!/usr/bin/env node
// Author: Damian "Rush" Kaczmarek

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const moduleAliases = packageJson._moduleAliases;

console.log('Setting up module aliases');

function js(strings, ...interpolatedValues) {
  return strings.reduce((total, current, index) => {
    total += current;
    if (interpolatedValues.hasOwnProperty(index)) {
      total += JSON.stringify(interpolatedValues[index]);
    }
    return total;
  }, '');
}

Object.keys(moduleAliases).forEach(key => {
  let statKey;
  try {
    statKey = fs.statSync(`node_modules/${key}`);
  } catch(err) {}
  
  if(statKey && statKey.isSymbolicLink()) {
    fs.unlinkSync(`node_modules/${key}`);
  } else if(fs.existsSync(`node_modules/${key}`) && !fs.existsSync(`node_modules/.link-module-alias-${key}`)) {
    console.log(`Module ${key} already exists and wasn't created by us, skipping`);
    return;
  } else {
    child_process.execFileSync('rm', ['-rf', `node_modules/${key}`])
  }

  const target = moduleAliases[key];
  if(target.match(/\.js$/)) {
    console.log(`Target ${target} is a direct link, creating proxy require`);
    fs.mkdirSync(`node_modules/${key}`);
    fs.writeFileSync(`node_modules/${key}/package.json`, js`
      {
        "name": ${key},
        "main": ${path.join('../../', target)}
      }
    `);
  } else {
    const stat = fs.statSync(target);
    if(!stat.isDirectory) {
      console.log(`Target ${target} is not a directory, skipping ...`)
    }
    console.log(`Target ${target} is a directory, creating symlink`);
    fs.symlinkSync(path.join('../', target), `node_modules/${key}`);
  }
  fs.writeFileSync(`node_modules/.link-module-alias-${key}`, '');
});