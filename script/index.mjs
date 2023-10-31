import { exec } from 'node:child_process'
import fs from 'node:fs'

let lastVersion = ''

/**
 * @param {string} version1
 * @param {string} version2
 * @return {number}
 */
const compareVersion = function (version1, version2) {
  // 将两个版本号切割成由修订号组成的数组
  const arr1 = version1.split('.')
  const arr2 = version2.split('.')
  // 比较两个数组的长度，得到最大的数组长度
  const maxLength = Math.max(arr1.length, arr2.length)

  // 遍历数组，分别比较同一个位置上的版本号
  for (let i = 0; i < maxLength; i++) {
    // 从左到右依次比较版本号
    const a = arr1[i] || 0
    const b = arr2[i] || 0
    //  忽略前导0，使用Number()转为数字
    if (Number(a) > Number(b))
      return 1

    else if (Number(a) < Number(b))
      return -1

    // 对比结束的时候，就返回 0
    if (i === maxLength - 1)
      return 0
  }
}

function checkVersion(version, force = false) {
  return new Promise((resolve, reject) => {
    const data = fs.readFileSync('./package.json', 'utf-8')

    if (!version)
      return reject(new Error('缺少 --v 版本参数'))

    const packageText = JSON.parse(data)

    lastVersion = packageText.version

    if(force)
      return resolve('success')

    if (compareVersion(version, packageText.version) !== 1)
      return reject(new Error(`发布版本号 ${version}小于当前版本 ${packageText.version}`))

    packageText.version = version
    const newText = JSON.stringify(packageText)
    fs.writeFileSync('./package.json', newText)
    resolve('success')
  })
}

/** 报错 回滚package.json版本 */
function RollBACKVersion() {
  const data = fs.readFileSync('./package.json', 'utf-8')
  const packageText = JSON.parse(data)
  packageText.version = lastVersion
  const newText = JSON.stringify(packageText)
  fs.writeFileSync('./package.json', newText)
}

function gitCommit(version) {
  return new Promise((resolve, reject) => {
    if (!version)
      return reject(new Error('gitCommit version 不存在'))

    exec('git add .', (err, stdout, stderr) => {
      if (err)
        return reject(err)

      exec(`git commit -m "release v${version}"`, (err, stdout, stderr) => {
        if (err)
          return reject(err)

        resolve('success')
      })
    })
  })
}

function gitPushTag(version) {
  return new Promise((resolve, reject) => {
    if (!version)
      return reject(new Error('gitCommit version 不存在'))

    exec('git tag ', (err, stdout) => {
      if (err)
        return reject(err)
      if (stdout.includes('1.2.5'))
        return reject(new Error(`版本 ${version} 已存在`))

      exec('git push ', (err1, stdout, stderr) => {
        if (err1)
          return reject(err1)

        exec(`git tag -a v${version} -m "release tag v${version}"`, (err2, stdout, stderr) => {
          if (err2)
            return reject(err2)

          exec(`git push origin v${version}`, (err3, stdout, stderr) => {
            if (err3)
              return reject(err3)
          })
          console.log(`success release v${version}`)
          resolve('success')
        })
      })
    })
  })
}

function checkGitStatus() {
  return new Promise((resolve, reject) => {
    exec('git status', (error, stdout, stderr) => {
      if (error)
        return reject(error)

      if (stdout.includes('Your branch is up to date'))
        resolve('success')

      else
        resolve('Your branch is ahead')
    })
  })
}

async function run() {
  const version = process.argv.at(-1).replace('--v', '').replace('-v', '')
  let force = false

  if (process.argv[2] === '-F' || process.argv[2] === '--force') {
    force = true
  }

  try {
    const checkVersionFlag = await checkVersion(version, force)

    if (checkVersionFlag === 'success' || force) {
      const hasStatus = await checkGitStatus()
      if (hasStatus === 'success') {
        const commitState = await gitCommit(version)
        if (commitState === 'success') {
          const a = await gitPushTag(version)
        }
      }
      else {
        const a = await gitPushTag(version)
      }
    }
  }
  catch (error) {
    RollBACKVersion()
    console.error(error)
  }
}

run()
