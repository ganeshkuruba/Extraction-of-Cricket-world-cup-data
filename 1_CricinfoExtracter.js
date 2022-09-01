let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let fs = require("fs");
let excel4node = require("excel4node");
let pdf = require("pdf-lib");
let path =require("path");



let args=minimist(process.argv);

let response = axios.get(args.source);
response.then(function(response){
    let html = response.data;
    
    let dom =new jsdom.JSDOM(html);
    let document=dom.window.document;
    
    let matches=[];
    let matchescoreDivs = document.querySelectorAll("div.match-score-block");
    for(let i = 0; i < matchescoreDivs.length; i++){
        let match ={
            t1 :" ",
            t2 :" ",
            t1s:" ",
            t2s:" ",
            result:" "
        };

        let namePs = matchescoreDivs[i].querySelectorAll("p.name");
        match.t1 =namePs[0].textContent;
        match.t2 =namePs[1].textContent;

        let scoreSpans = matchescoreDivs[i].querySelectorAll("div.score-detail > span.score");
        if(scoreSpans.length == 2){
            match.t1s =scoreSpans[0].textContent;
            match.t2s =scoreSpans[1].textContent;
        }else if(scoreSpans.length == 1){
            match.t1s =scoreSpans[0].textContent;
            match.t2s ="";
        }else{
            match.t1s ="";
            match.t2s ="";
        }
        
        let spanResult = matchescoreDivs[i].querySelector("div.status-text > span");
        match.result =spanResult.textContent;

        matches.push(match);
    }
        let matchesJSON = JSON.stringify(matches);
        fs.writeFileSync("matches.json", matchesJSON, "utf-8");

        let teams=[];
        for (let i=0 ; i<matches.length ; i++){
            populateTeams(teams,matches[i].t1);
            populateTeams(teams,matches[i].t2);
        }
        for (let i=0 ; i < matches.length ; i++){
            putmatchInappropriateTeam(teams,matches[i].t1,matches[i].t2,matches[i].t1s,matches[i].t2s,matches[i].result);
            putmatchInappropriateTeam(teams,matches[i].t2,matches[i].t1,matches[i].t2s,matches[i].t1s,matches[i].result)
        }

        let teamsJSON = JSON.stringify(teams);
        fs.writeFileSync("teams.json", teamsJSON, "utf-8");
        
        prepareExcel(teams,args.excel);
        prepareFoldersAndPdfs(teams,args.dataDir);
})

function prepareFoldersAndPdfs(teams, dataDir) {
    if(fs.existsSync(dataDir) == true){
        fs.rmdirSync(dataDir, { recursive: true });
    }

    fs.mkdirSync(dataDir);

    for (let i = 0; i < teams.length; i++) {
        let teamFolderName = path.join(dataDir, teams[i].name);
        fs.mkdirSync(teamFolderName);

        for (let j = 0; j < teams[i].matches.length; j++) {
            let match = teams[i].matches[j];
            createMatchScorecardPdf(teamFolderName, teams[i].name, match);
        }
    }
}

function createMatchScorecardPdf(teamFolderName, homeTeam, match) {
    let matchFileName = path.join(teamFolderName, match.vs);

    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocKaPromise.then(function (pdfdoc) {
        let page = pdfdoc.getPage(0);

        page.drawText(homeTeam, {
            x: 320,
            y: 665,
            size: 16
        });
        page.drawText(match.vs, {
            x: 320,
            y: 638,
            size: 16
        });
        page.drawText(match.selfScore, {
            x: 320,
            y: 610,
            size: 16
        });
        page.drawText(match.oppScore, {
            x: 320,
            y: 578,
            size: 16
        });
        page.drawText(match.result, {
            x: 320,
            y: 550,
            size: 16
        });

        let changedBytesKaPromise = pdfdoc.save();
        changedBytesKaPromise.then(function (changedBytes) {
            if(fs.existsSync(matchFileName + ".pdf") == true){
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            } else {
                fs.writeFileSync(matchFileName + ".pdf", changedBytes);
            }
        })
    })
}

function prepareExcel(teams, excelFileName) {   
    let wb = new excel4node.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let tsheet = wb.addWorksheet(teams[i].name);

        tsheet.cell(1, 1).string("Vs");
        tsheet.cell(1, 2).string("Self Score");
        tsheet.cell(1, 3).string("Opp Score");
        tsheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            tsheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            tsheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            tsheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            tsheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(excelFileName);
}

function populateTeams(teams, teamname){
    let tidx = -1;
    for(let i = 0 ; i < teams.length ; i++){
         if(teams[i].name == teamname){
         tidx = i;
         break;
        }
    }
    if(tidx == -1){
        teams.push({
            name : teamname,
            matches : []     
        })
    }
    
}

function putmatchInappropriateTeam(teams,hometeam,oppteam,selfScore,oppScore,result){
    let tidx = -1;
    for(let i = 0 ; i < teams.length ; i++){
        if(teams[i].name == hometeam){
            tidx = i;
            break;
        }
    }

    let team =teams[tidx];
    team.matches.push({
        vs : oppteam,
        selfScore : selfScore,
        oppScore : oppScore,
        result : result
    })
}
