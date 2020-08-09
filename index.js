const https = require('https')
const fs = require('fs')
const path = require('path')

global.https = https
global.fs = fs
global.path = path

global.cwd = ""
global.destDir = ""
global.ops = {}
global.watching = []


global.getPath = p => {
	p = p.trim()
	if(p.substr(0, 2) !== "./"){
		if(p[0] === "/"){
			p = p.substr(1)
		}
		p = "./" + p
	}
	return p
}


const lorem = n => {
	const loremWords = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam efficitur libero neque, sit amet ultrices lacus accumsan vitae. Donec volutpat hendrerit metus ut mollis. Proin condimentum ligula ut sagittis varius. Nulla id auctor felis. Pellentesque ornare, dolor vel interdum dignissim, lectus risus blandit nisi, at ultrices ipsum orci sed tortor. Nulla semper, tortor molestie malesuada vulputate, felis augue sodales odio, sit amet tempus neque arcu sed enim. Pellentesque gravida tempor gravida. Mauris lacus orci, lacinia vitae semper id, finibus vitae mi. Phasellus sit amet eros risus. Suspendisse sed interdum metus. Pellentesque vel tempor mauris, vitae feugiat leo.".split(" ")
	const len = loremWords.length
	if(n < len){
		return loremWords.slice(0, n).join(" ")
	}else{
		let res = []
		let totalAdded = 0
		for(let i = 0; i < parseInt(n / len); i++){
			res = [...res, ...loremWords]
			totalAdded += len
		}
		res = [...res, ...(loremWords.slice(0, n - totalAdded))]
		return res.join(" ")
	}
}

const picsum = (width, height = false, s = false) => {
	let url = "https://picsum.photos/"
	if(s){
		url = url + "seed/picsum/"
	}
	url = url + width
	if(height){
		url = url + "/" + height
	}
	return url
}


const font = (name, weights = [400]) => {
	let res = "https://fonts.googleapis.com/css2?family="
	res += name.replace(/ /g, '+')
	res += ":wght@"
	res += weights.join(";")
	res += "&display=swap"
	return res
}


const resource = (url, destPath, name) => {
	let dp = global.path.join(global.destDir, destPath)
	let df = global.path.join(dp, name)
	let fs = global.fs
	try{
		if(fs.existsSync(df)){
			global.ops.info && console.log("\x1b[33m", name + " found in " + dp + " skipping download")
			return global.path.join(destPath, name)
		}
		!fs.existsSync(dp) && fs.mkdirSync(dp)
	    const file = fs.createWriteStream(df)
		global.ops.info && console.log("\x1b[33m", name + " will be downloaded in " + dp)
		global.https.get(url, response => {
			response.pipe(file)
		})
	}catch(err){
		console.log("\x1b[31m", "Could not download " + name + ": " + err)
	}
	return global.path.join(destPath, name)
}


global. modStr =  str => {
	let len = str.length
	let sb = str.substr(0, 2)
	let eb = str.substr(len - 2, 2)
	str = str.substr(2, len - 4).trim()
	str = str.replace(/[\n\r\t]/g, "")
	return sb + str + eb
}


global.Templater = templateText => {
	return new Function(
		"data, hbt = " + hbtUtils,
		"let output=" +
		JSON.stringify(templateText)
		.replace(/({{(.+?)}})|(<%(.+?)%>)/gs, global. modStr)
		.replace(/{{(.+?)}}/g, '"+($1)+"')
		.replace(/<%(.+?)%>/g, '";$1\noutput+="') +
		";return output;"
	)
}


global.compileFile = (src, data) => {
	src = global.getPath(src)
	try{
		let pcwd = global.cwd
		let cp = path.join(global.cwd, src)
		global.cwd = cp
		global.ops.info && console.log("\x1b[33m", "compiling " + cp + " ...")
		let templateText = fs.readFileSync(global.cwd)
		templateText = templateText.toString()
		if(global.ops.minify){
			templateText = templateText.replace(/\n/g, "").replace(/\r/g, '').replace(/\t/g, '')
		}
		const render = global.Templater(templateText)
		global.cwd = pcwd
		global.ops.info && console.log("\x1b[36m", "compiled " + cp)
		let res = render(data)
		return res
	}catch(err){
		console.log("\x1b[31m", "Error compiling templete: " + err)
	}
	return false
}


const include = (src, data = {}) => {
	let p = global.getPath(src)
	if(global.ops.watch){
		global.watching.push(global.getPath(global.path.join(global.cwd, p)))
	}
	let res = global.compileFile(p, data)
	return res
}


const hbtUtils = `{
	PI: 3.14159,
	lorem: ${ lorem },
	picsum: ${ picsum },
	resource: ${ resource },
	font: ${ font },
	include: ${ include }
}`


const compile = (src, dest, data = {}, ops = {}) => {
	let sp, dp, sf
	const init = () => {
		global.ops = Object.assign({
			minify: false,
			watch: false,
			infos: true
		}, ops)
		src = global.getPath(src)
		dest = global.getPath(dest)
		
		sp = src.split("/")
		sf = sp.pop()
		sp = sp.join("/")
		
		dp = dest.split("/")
		dp.pop()
		dp = dp.join("/")
		global.destDir = dp
	}
	
	const watch = () => {
		for(let f of global.watching){
			fs.watchFile(f, () => {
				if(global.ops.info){
					console.log("\x1b[33m", f + " changed")
					console.log("\x1b[33m", "recompiling ...")
				}else{
					console.log("\x1b[33m", "changes detected recompiling ...")
				}
				run()
			})
		}
		console.log("\x1b[32m", "*watching changes*")
	}
	
	const unwatch = () => {
		while(global.watching.length){
			fs.unwatchFile(global.watching.pop())
		}
	}
	
	function run(){
		global.cwd = sp
		try{
			const output = global.compileFile(sf, data)
			!fs.existsSync(dp) && fs.mkdirSync(dp)
			fs.writeFileSync(dest, output)
			console.log("\x1b[36m", "compilation finished")
			
			if(global.ops.watch){
				unwatch()
				global.watching.push(src)
				watch()
			}
		}catch(err){
			console.log("\x1b[31m", "Error bundling templete: " + err)
		}
	}
	
	init()
	run()
}


module.exports = { compile }