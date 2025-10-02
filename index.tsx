

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- Type Definitions ---
type AppState = 'url-input' | 'scoreboard';
type Status = '예정' | '진행중' | '종료';
type Scores = { [className: string]: number };
type ManualStatus = '활성' | '종료' | '예정';

// Player data types
interface TugOfWarPlayerClass {
  women: string[];
  men_vanguard: string[];
  men_rearguard: string[];
  reserve: string[];
}
type PlayerData = string[] | TugOfWarPlayerClass;


// Base type for an event from initial data or sheet
interface SportsEventData {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  rules?: string;
  gameFormat?: string;
  scores?: Scores;
  manualStatus?: ManualStatus;
  lunchMenu?: string;
  lineup?: string[];
  missions?: { [grade: string]: { [runner: string]: string[] } };
  players?: {
    [grade: string]: {
      [className: string]: PlayerData;
    };
  };
  danceTeams?: { [teamName: string]: { members: string[]; songs: string[] } };
  teacherTeams?: { [teamName: string]: string[] };
}

// Full event type used in the UI, with calculated status
interface SportsEvent extends SportsEventData {
  status: Status;
}

// --- Type for fetched sheet updates ---
interface SheetUpdates {
    scoresByEvent: { [eventId: number]: Scores };
    manualStatuses: { [eventId: number]: ManualStatus };
    cheeringScores: Scores;
}


// --- Data Service (using Google Sheets 'Publish to the web' CSV) ---
const eventService = {
  // Fetches all dynamic updates from the published sheet
  async fetchEventUpdates(sheetUrl: string): Promise<SheetUpdates> {
    console.log(`[DATA] Fetching updates from Google Sheet: ${sheetUrl}`);
    
    try {
      const response = await fetch(`${sheetUrl}&t=${new Date().getTime()}`);
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.statusText}`);
      }
      const csvText = await response.text();
      
      if (csvText.trim().toLowerCase().startsWith('<!doctype html') || csvText.trim().startsWith('<html')) {
        throw new Error("잘못된 URL 형식입니다. Google Sheets '웹에 게시' 기능에서 'CSV'로 내보낸 링크가 맞는지 확인해주세요.");
      }
      
      const parsedData = this.parseCsvData(csvText);

      return parsedData;

    } catch (error) {
      console.error("Failed to fetch or parse Google Sheet data:", error);
      throw error; // Propagate error to be handled by the UI
    }
  },

  parseCsvData(csvText: string): SheetUpdates {
    const CHEERING_SCORE_EVENT_ID = 8;
    const scoresByEvent: { [eventId: number]: Scores } = {};
    const manualStatuses: { [eventId: number]: ManualStatus } = {};
    const cheeringScores: Scores = {};

    const rows = csvText.trim().split(/\r?\n/).slice(1); // skip header

    rows.forEach(row => {
        // Handle empty rows that can occur in CSV
        if (!row.trim()) return;

        const cells = row.split(',').map(cell => cell ? cell.trim().replace(/"/g, '') : '');
        
        // All valid data rows we care about (scores, statuses) must have an eventId in column A.
        // Bracket rows (which had an empty column A) are no longer processed.
        if (cells[0]) {
            const eventId = parseInt(cells[0], 10);
            if (isNaN(eventId)) return; // Skip if eventId is not a number

            const className = cells[1];
            const scoreStr = cells[2];
            const statusStr = cells[3];
            const score = parseInt(scoreStr, 10);

            // Check if it's a valid score row
            const isScoreRow = className && !isNaN(score);
            if (isScoreRow) {
                if (eventId === CHEERING_SCORE_EVENT_ID) {
                    cheeringScores[className] = score;
                } else {
                    if (!scoresByEvent[eventId]) scoresByEvent[eventId] = {};
                    scoresByEvent[eventId][className] = score;
                }
                return; // A row is either a score or a status, not both.
            }
            
            // Check if it's a valid status row
            const cleanStatus = statusStr ? statusStr.normalize() : '';
            if (cleanStatus === '활성' || cleanStatus === '종료' || cleanStatus === '예정') {
                 manualStatuses[eventId] = cleanStatus as ManualStatus;
            }
        }
    });

    return { scoresByEvent, manualStatuses, cheeringScores };
  }
};
// --- END Data Service ---

// --- Initial Data (Static part of the events) ---
const getInitialEvents = (): SportsEventData[] => {
  const fiveClassMissions = {
    '1번 주자 (여자)': [
      '바통 정하기 (오렌지)',
      '바통 정하기 (같은 반 친구 한 명)',
      '바통 정하기 (대형 바통)',
      '바통 정하기 (배구공)',
      '바통 정하기 (클립)'
    ],
    '2번 주자 (남자)': [
      '한발로 달리기',
      '경보',
      '물 안 쏟고 달리기',
      '뒷주자와 함께 2인 3각',
      '훌라후프하며 달리기'
    ],
    '3번 주자 (여자)': [
      '숟가락에 탁구공 올리고 달리기',
      '줄넘기하며 달리기',
      '인물 데리고 달리기',
      '뒤로 달리기',
      '배구공 드리블하며 달리기'
    ],
    '4번 주자 (남자) (성공해야 출발가능)': [
      '밀가루 속 사탕 얼굴로 찾아서 보여주기',
      '코끼리 코 20바퀴',
      '풍선 5개 터뜨리기',
      '슬리퍼 던져서 바구니(훌라후프)에 넣기',
      '강냉이 5개 던져서 입에 넣기'
    ]
  };

  const fourClassMissions = {
    '1번 주자 (여자)': [
      '바통 정하기 (오렌지)',
      '바통 정하기 (같은 반 친구 한 명)',
      '바통 정하기 (대형 바통)',
      '바통 정하기 (배구공)'
    ],
    '2번 주자 (남자)': [
      '한발로 달리기',
      '물 안 쏟고 달리기',
      '뒷주자와 함께 2인 3각',
      '훌라후프하며 달리기'
    ],
    '3번 주자 (여자)': [
      '줄넘기하며 달리기',
      '인물 데리고 달리기',
      '뒤로 달리기',
      '배구공 드리블하며 달리기'
    ],
    '4번 주자 (남자) (성공해야 출발가능)': [
      '밀가루 속 사탕 얼굴로 찾아서 보여주기',
      '풍선 5개 터뜨리기',
      '슬리퍼 던져서 바구니(훌라후프)에 넣기',
      '강냉이 5개 던져서 입에 넣기'
    ]
  };

  const tugOfWarPlayers = {
    '1': {
      '1-1': { women: ['강혜윤', '정지이', '김승연', '김은혜', '김가율', '이시현', '김혜인', '김소연'], men_vanguard: ['이수민', '윤준서', '김주원', '한우석'], men_rearguard: ['홍준서', '전민규', '정지우', '배서준'], reserve: ['조용민', '이하진'] },
      '1-2': { women: ['배지은', '백단비', '박수민', '양세경', '이사랑', '조아라', '김여준', '전다은'], men_vanguard: ['김준성', '서지후', '이서준', '정태환'], men_rearguard: ['김찬수', '유승호', '이희수', '최시우'], reserve: ['박민찬', '서연정'] },
      '1-3': { women: ['김사랑', '정지우', '김윤서', '이수정', '유해인', '이자은'], men_vanguard: ['백승준', '윤홍민', '이서원', '정윤재'], men_rearguard: ['김신우', '양건우', '오태준', '박서준'], reserve: [] },
      '1-4': { women: ['김태연', '방아인', '강혜연', '은서연', '김민서', '이채윤', '임규리', '최지은'], men_vanguard: ['박용원', '김동현', '김지완', '서민재'], men_rearguard: ['오성민', '안태산', '이지웅', '한서준'], reserve: ['김희찬', '이우혁', '김혜림', '권도연'] },
      '1-5': { women: ['김다은', '김보민', '김지현', '윤현서', '이서윤', '이수지', '이지수', '전영은'], men_vanguard: ['손정무', '이현태', '김주찬', '김도훈'], men_rearguard: ['신연우', '김지호', '유민혁', '김규담'], reserve: ['홍시우', '최서진', '이서윤', '정혜원'] },
    },
    '2': {
      '2-1': { women: ['선우서윤', '이진', '한예지', '류예원', '차수아', '최윤아', '김봄', '남지우', '배현주', '정지우', '이유진', '심지민'], men_vanguard: ['이지안', '황시후', '조민준', '이도윤', '박주형'], men_rearguard: ['주지성', '김지형', '김은우', '이태준', '안성재'], reserve: ['안성재'] },
      '2-2': { women: ['강도현', '권희윤', '김다영', '김민서', '김수진', '공예주', '성솔지', '이예나', '이하은', '남지수', '백소희', '조가율'], men_vanguard: ['우상혁', '김형준', '이주원', '박수호', '나연호'], men_rearguard: ['양정혁', '임형준', '이유건', '서희', '김현성'], reserve: ['최인혁', '전민성', '이다인', '기민서'] },
      '2-3': { women: ['임다현', '장지은', '강다혜', '노은지', '전서현', '최지유', '강민지', '유지수', '강은호', '도예슬', '고서연', '이지인'], men_vanguard: ['신우태', '장동우', '박현태', '김서준', '염시혁'], men_rearguard: ['이준', '안은찬', '김성태', '김우현', '이우영'], reserve: ['조동찬', '김민형', '염지효'] },
      '2-4': { women: ['홍지민', '진서현', '이예서', '지의정', '한지효', '오윤서', '최지효', '김민서'], men_vanguard: ['김여준', '이준수', '임선호', '최민준'], men_rearguard: ['권도윤', '정율', '안성진', '문현준'], reserve: ['신유진', '김기준', '서예담'] },
    },
    '3': {
      '3-1': { women: ['정하율', '김희서', '이채원', '윤유진', '이자빈', '김예나', '서재인', '권도희', '김별', '황자빈'], men_vanguard: ['이서후', '안수찬', '김혜강', '윤홍현', '지성빈', '강현성'], men_rearguard: ['임하윤', '백석훈', '한규선', '박예준', '이재호', '서현준'], reserve: ['박찬유', '이율'] },
      '3-2': { women: ['김다은', '이하윤', '김하늘', '이화은', '신수빈', '임예주', '양은서', '하윤지', '이서정', '허수빈'], men_vanguard: ['이태환', '이시현', '이서준', '소지혁', '오원재', '이선율'], men_rearguard: ['허유찬', '이희준', '최한결', '최지훈', '김재유', '임성준'], reserve: ['박진성', '박시은'] },
      '3-3': { women: ['장지연', '김다희', '이루미', '채희원', '배가은', '이다인', '안지현', '김가은', '박정윤', '정혜인'], men_vanguard: ['윤지효', '이성윤', '이지호', '김규민', '서진유', '송주원'], men_rearguard: ['오건우', '임시현', '유경민', '송민혁', '이유찬', '서귀석'], reserve: ['김강민', '김민준', '박슬기'] },
      '3-4': { women: ['이슬채', '서영진', '손예주', '김서윤', '박지우', '안은서', '문예빈', '정혜원', '이하린', '김가은'], men_vanguard: ['윤중근', '엄재민', '권도훈', '김범준', '김경필', '고도윤'], men_rearguard: ['박진오', '정율원', '박영현', '윤태영', '안주훈', '이준혁'], reserve: ['이연우', '박지후'] },
      '3-5': { women: ['김나연', '고다윤', '최윤아', '이유진', '김단아', '오채현', '강한나', '권도연', '임서영', '김수인'], men_vanguard: ['최시우', '이윤제', '김예찬', '최지호', '류강민', '김주훈'], men_rearguard: ['장재빈', '장승훈', '박성원', '이강휘', '유영진', '임서준'], reserve: ['곽덕환', '이희승', '박채은', '진다빈'] },
    }
  };
  
  const missionRunningPlayers = {
    '1': {
      '1-1': ['이시연', '김주원', '강혜원', '채종혁'],
      '1-2': ['양세경', '김준성', '배지은', '최시우'],
      '1-3': ['김예빈', '박서준', '안유나', '신재훈'],
      '1-4': ['방아인', '이우혁', '은서연', '이지웅'],
      '1-5': ['김다은', '김지호', '이지수', '김주찬'],
    },
    '2': {
      '2-1': ['최윤아', '황시후', '선우서윤', '박주형'],
      '2-2': ['이하은', '우상혁', '김민서', '서희'],
      '2-3': ['임다현', '장동우', '강민지', '박현태'],
      '2-4': ['지의정', '권도윤', '한지효', '문현준'],
    },
    '3': {
      '3-1': ['이자빈', '윤홍현', '윤유진', '이서후'],
      '3-2': ['허수빈', '소지혁', '김다은', '임성준'],
      '3-3': ['배가은', '서진유', '김다희', '임시현'],
      '3-4': ['안은서', '김범준', '김서윤', '김경필'],
      '3-5': ['고다윤', '김예찬', '이유진', '김주훈'],
    }
  };

  const relayRacePlayers = {
    '1': {
      '1-1': ['이하진', '한우석', '김소연', '윤준서'],
      '1-2': ['전다은', '이서준', '이사랑', '박민찬'],
      '1-3': ['정유리나', '박유능', '채희은', '우승현'],
      '1-4': ['강혜원', '서민재', '강태연', '김동현'],
      '1-5': ['김보민', '손정무', '윤현서', '유민혁'],
    },
    '2': {
      '2-1': ['이진', '이지안', '김봄', '송물결'],
      '2-2': ['권희윤', '최인혁', '이예소', '이유진'],
      '2-3': ['전서현', '이준', '강다혜', '염시혁'],
      '2-4': ['홍지민', '이준수', '오윤서', '임선호'],
    },
    '3': {
      '3-1': ['이채원', '김혜강', '김예나', '유창민'],
      '3-2': ['하윤지', '이시현', '신수빈', '최한결'],
      '3-3': ['장지연', '이지호', '이루미', '오건우'],
      '3-4': ['이하린', '윤중근', '손예주', '고도윤'],
      '3-5': ['김나연', '최지호', '최윤아', '류강민'],
    }
  };

  return [
    { id: 0, title: '준비운동 및 개회식', startTime: '08:50', endTime: '09:15', location: '운동장' },
    {
      id: 1,
      title: '미션 달리기',
      startTime: '09:15',
      endTime: '10:10',
      location: '운동장',
      scores: { '1-1': 0, '1-2': 0, '1-3': 0, '1-4': 0, '1-5': 0, '2-1': 0, '2-2': 0, '2-3': 0, '2-4': 0, '3-1': 0, '3-2': 0, '3-3': 0, '3-4': 0, '3-5': 0 },
      rules: `1. 주자는 결승점을 향해 달리면서 주어진 미션을 하나씩 수행해야 합니다.

  2. 미션을 성공적으로 완료하고 다음 주자에게 이어 달리기를 하면 됩니다.

  3. 모든 주자가 미션을 마치고 가장 먼저 결승선을 통과한 팀이 승리합니다.`,
      missions: {
        '1': fiveClassMissions,
        '2': fourClassMissions,
        '3': fiveClassMissions
      },
      players: missionRunningPlayers,
    },
    {
      id: 2,
      title: '줄다리기',
      startTime: '10:10',
      endTime: '11:00',
      location: '운동장',
      scores: { '1-1': 0, '1-2': 0, '1-3': 0, '1-4': 0, '1-5': 0, '2-1': 0, '2-2': 0, '2-3': 0, '2-4': 0, '3-1': 0, '3-2': 0, '3-3': 0, '3-4': 0, '3-5': 0 },
      rules: `1. 심판의 시작 신호가 울리면 여학생들이 먼저 줄을 당기기 시작한다.

  2. 시작 5초 뒤, 심판의 휘슬에 맞춰 남학생 선발대가 출발선에서 줄에 합류한다.

  3. 다시 5초 뒤, 심판의 휘슬과 함께 남학생 후발대도 줄에 합류한다.

  4. 두 팀 모두 전원이 합류한 뒤, 힘과 팀워크로 줄을 끝까지 당긴다.

  5. 중앙 기준선을 기준으로 상대 팀을 자기 쪽으로 끌어오면 승리!

  6. 경기에 참여하는 인원은 양 팀 모두 같아야 하며, 인원이 적은 팀 기준으로 맞춘다.`,
      gameFormat: `• 모든 예선전은 단판으로 진행합니다.\n• 결승전은 3판 2선승제로 진행하며, 1:1 동점 시 전통 줄다리기로 승부를 가립니다.\n\n[진행 순서]\n1학년 → 2학년 → 3학년 순으로 예선 및 결승이 진행됩니다.`,
      players: tugOfWarPlayers,
    },
    {
      id: 3,
      title: '교사 vs 교사 이벤트 계주',
      startTime: '11:00',
      endTime: '11:20',
      location: '운동장',
      rules: `🎉 선생님들의 자존심을 건 한판 승부! 🎉\n이과팀과 문과팀, 과연 어느 팀이 운동장을 지배할까요? 학생 여러분의 뜨거운 응원이 필요합니다! 🔥`,
      teacherTeams: {
        '문과 팀': ['👑 신승호', '공진현', '노예은', '한지수', '김지윤'],
        '이과 팀': ['👑 신진섭', '윤해움', '임재철', '김재홍', '김민지']
      }
    },
    {
      id: 4,
      title: '댄스팀 공연',
      startTime: '11:20',
      endTime: '11:35',
      location: '운동장',
      danceTeams: {
        '케이팝 중원 헌터스': {
            members: ['류강민', '윤중근', '고도윤'],
            songs: ['GOLDEN']
        },
        '금슬연화': {
            members: ['이유진(3학년)', '홍지민', '최윤아', '최지유', '강다혜', '한지효'],
            songs: ['에스파 - Dirty work', '효린 - 바다보러갈래']
        },
      }
    },
    {
      id: 5,
      title: '계주',
      startTime: '11:35',
      endTime: '12:25',
      location: '운동장',
      scores: { '1-1': 0, '1-2': 0, '1-3': 0, '1-4': 0, '1-5': 0, '2-1': 0, '2-2': 0, '2-3': 0, '2-4': 0, '3-1': 0, '3-2': 0, '3-3': 0, '3-4': 0, '3-5': 0 },
      rules: `1. 각 학년 모두 예선 없이 바로 본선 경기로 진행됩니다.

  2.주자는 바통을 이어받아 1바퀴씩 달리며 팀 경기를 이어갑니다.

  3.모든 주자가 달린 뒤 결승점에 가장 먼저 들어오는 순서대로 순위가 결정됩니다.`,
      players: relayRacePlayers,
    },
    { id: 6, title: '폐회식', startTime: '12:25', endTime: '12:40', location: '운동장' },
    {
      id: 7,
      title: '점심시간 및 뒷정리',
      startTime: '12:40',
      endTime: '13:20',
      location: '운동장',
      lunchMenu: `🍚 치킨마요덮밥\n🍜 가쓰오우동국\n🥘 치즈옹심이떡볶이\n🥮 단무지무침\n🥬 배추김치\n🍍 파인애플`
    },
  ];
};

// --- Helper Functions ---
const getCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const getEventStatus = (startTime: string, endTime: string, currentTime: string, manualStatus?: ManualStatus): Status => {
  // Manual override from Google Sheet takes precedence
  if (manualStatus === '활성') return '진행중';
  if (manualStatus === '종료') return '종료';
  if (manualStatus === '예정') return '예정';

  // Fallback to time-based logic
  if (currentTime < startTime) return '예정';
  if (currentTime >= startTime && currentTime < endTime) return '진행중';
  return '종료';
};

// --- Components ---

// --- Tournament Bracket Types and Data ---
type TeamSpec = string | { winnerOf: string };
interface Match {
  id: string;
  teams: [TeamSpec, TeamSpec];
}
interface Round {
  title: string;
  matches: Match[];
}
interface BracketData {
  [grade: string]: { rounds: Round[] };
}

const bracketData: BracketData = {
  '1': { // 5 teams
    rounds: [
      { title: '1라운드', matches: [{ id: 'g1-r1-m1', teams: ['3반', '2반'] }, { id: 'g1-r1-m2', teams: ['4반', '1반'] }] },
      { title: '준결승', matches: [{ id: 'g1-r2-m1', teams: [{ winnerOf: 'g1-r1-m1' }, '5반'] }] },
      { title: '결승', matches: [{ id: 'g1-r3-m1', teams: [{ winnerOf: 'g1-r1-m2' }, { winnerOf: 'g1-r2-m1' }] }] },
    ],
  },
  '2': { // 4 teams
    rounds: [
      { title: '준결승', matches: [{ id: 'g2-r1-m1', teams: ['1반', '4반'] }, { id: 'g2-r1-m2', teams: ['2반', '3반'] }] },
      { title: '결승', matches: [{ id: 'g2-r2-m1', teams: [{ winnerOf: 'g2-r1-m1' }, { winnerOf: 'g2-r1-m2' }] }] },
    ],
  },
  '3': { // 5 teams
    rounds: [
      { title: '1라운드', matches: [{ id: 'g3-r1-m1', teams: ['3반', '2반'] }, { id: 'g3-r1-m2', teams: ['4반', '5반'] }] },
      { title: '준결승', matches: [{ id: 'g3-r2-m1', teams: [{ winnerOf: 'g3-r1-m2' }, '1반'] }] },
      { title: '결승', matches: [{ id: 'g3-r3-m1', teams: [{ winnerOf: 'g3-r1-m1' }, { winnerOf: 'g3-r2-m1' }] }] },
    ],
  },
};

const placeholderMap: Record<string, string> = {
    'g1-r1-m1': '(1R 1G 승리팀)', 'g1-r1-m2': '(1R 2G 승리팀)', 'g1-r2-m1': '(준결승 승리팀)',
    'g2-r1-m1': '(준결승 1G 승리팀)', 'g2-r1-m2': '(준결승 2G 승리팀)',
    'g3-r1-m1': '(1R 1G 승리팀)', 'g3-r1-m2': '(1R 2G 승리팀)', 'g3-r2-m1': '(준결승 승리팀)',
};


const TournamentBracketModal: React.FC<{ 
    onClose: () => void;
}> = ({ onClose }) => {
    const [activeGrade, setActiveGrade] = useState('2');
    // All winners are now managed locally in this component's state
    const [winners, setWinners] = useState<{ [matchId: string]: string }>({});

    const handleMatchWin = useCallback((matchId: string, winner: string, grade: string) => {
        setWinners(currentWinners => {
            const newWinners = { ...currentWinners };

            // If the same winner is clicked again, deselect it. Otherwise, set the new winner.
            if (newWinners[matchId] === winner) {
                delete newWinners[matchId];
            } else {
                newWinners[matchId] = winner;
            }

            // When a winner is chosen or deselected, we must clear subsequent matches
            const clearDependents = (mId: string) => {
                const gradeBracket = bracketData[grade];
                if (!gradeBracket) return;

                gradeBracket.rounds.forEach(round => {
                    round.matches.forEach(match => {
                        const dependsOnThisMatch = match.teams.some(
                            team => typeof team === 'object' && team.winnerOf === mId
                        );
                        if (dependsOnThisMatch && newWinners[match.id]) {
                            const dependentMatchId = match.id;
                            delete newWinners[dependentMatchId];
                            clearDependents(dependentMatchId);
                        }
                    });
                });
            };
            
            clearDependents(matchId);
            return newWinners;
        });
    }, []);

    const handleResetBracket = useCallback(() => {
        setWinners(currentWinners => {
            const newWinners = { ...currentWinners };
            const gradeBracket = bracketData[activeGrade];
            if (!gradeBracket) return currentWinners;

            // Get all match IDs for the current grade and remove them from the winners object
            const matchIdsForGrade = gradeBracket.rounds.flatMap(r => r.matches.map(m => m.id));
            for (const id of matchIdsForGrade) {
                delete newWinners[id];
            }

            return newWinners;
        });
    }, [activeGrade]);

    const renderBracket = (grade: string) => {
        const gradeBracket = bracketData[grade];
        if (!gradeBracket) return null;

        const getTeamDisplay = (teamSpec: TeamSpec): string => {
            if (typeof teamSpec === 'string') return teamSpec;
            return winners[teamSpec.winnerOf] || (placeholderMap[teamSpec.winnerOf] || '(승리팀)');
        };

        const areTeamsReady = (match: Match): boolean => {
            return match.teams.every(teamSpec => {
                if (typeof teamSpec === 'string') return true;
                return !!winners[teamSpec.winnerOf];
            });
        };

        return (
            <div className="vertical-bracket">
                {gradeBracket.rounds.map((round) => (
                    <div key={round.title} className="bracket-round">
                        <h4 className="bracket-round-title">{round.title}</h4>
                        <div className="bracket-matches">
                            {round.matches.map((match) => {
                                const team1Name = getTeamDisplay(match.teams[0]);
                                const team2Name = getTeamDisplay(match.teams[1]);

                                const matchWinner = winners[match.id];
                                const isReady = areTeamsReady(match);
                                const isFinalRound = round.title === '결승';

                                return (
                                    <div key={match.id} className={`match-connector-group ${isFinalRound ? 'final' : ''}`}>
                                        <div className="match-card">
                                            <button
                                                className={`team ${matchWinner === team1Name ? 'winner' : ''} ${matchWinner && matchWinner !== team1Name ? 'loser' : ''}`}
                                                onClick={() => handleMatchWin(match.id, team1Name, grade)}
                                                disabled={!isReady}
                                            >
                                                {team1Name}
                                            </button>
                                            <div className="vs">vs</div>
                                            <button
                                                className={`team ${matchWinner === team2Name ? 'winner' : ''} ${matchWinner && matchWinner !== team2Name ? 'loser' : ''}`}
                                                onClick={() => handleMatchWin(match.id, team2Name, grade)}
                                                disabled={!isReady}
                                            >
                                                {team2Name}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content tournament-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>⚔️ 학년별 줄다리기 대진표 (시뮬레이션)</h3>
                    <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
                </div>
                <div className="modal-body">
                    <p className="bracket-description">
                        이 대진표는 셀프 체크 시스템입니다.
                        <br />
                        직접 버튼을 눌러 대진표를 시뮬레이션 해보세요!
                    </p>
                    <div className="tabs bracket-tabs">
                        <button className={`tab-button ${activeGrade === '1' ? 'active' : ''}`} onClick={() => setActiveGrade('1')} aria-pressed={activeGrade === '1'}>1학년</button>
                        <button className={`tab-button ${activeGrade === '2' ? 'active' : ''}`} onClick={() => setActiveGrade('2')} aria-pressed={activeGrade === '2'}>2학년</button>
                        <button className={`tab-button ${activeGrade === '3' ? 'active' : ''}`} onClick={() => setActiveGrade('3')} aria-pressed={activeGrade === '3'}>3학년</button>
                    </div>
                    <div className="bracket-content-wrapper">
                        {renderBracket(activeGrade)}
                    </div>
                    <div className="bracket-controls">
                        <button className="bracket-control-button" title="현재 학년 대진표 초기화" aria-label="리셋" onClick={handleResetBracket}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnnouncerModal: React.FC<{ onClose: () => void; }> = ({ onClose }) => {
    const announcers = [
        "김여준 (1학년 2반)",
        "이도윤 (2학년 1반)",
        "김예찬 (3학년 5반)"
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content special-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>🎤 아나운서 명단</h3>
                    <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
                </div>
                <div className="modal-body">
                    <div className="special-list-container">
                        {announcers.map((name, index) => (
                            <div key={index} className="special-list-item announcer-item">
                                <span className="item-icon">📣</span>
                                <span className="item-text">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface TeamDetailModalProps {
    onClose: () => void;
    title: string;
    teamName: string;
    members: string[];
    songs?: string[];
    isTeacherTeam?: boolean;
}

const TeamDetailModal: React.FC<TeamDetailModalProps> = ({ onClose, title, teamName, members, songs, isTeacherTeam = false }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content special-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{`${title} > ${teamName}`}</h3>
                    <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
                </div>
                <div className="modal-body">
                    {songs && songs.length > 0 && (
                        <div className="team-detail-section">
                            <h4>🎵 공연 곡</h4>
                            <ul className="song-list">
                                {songs.map((song, index) => <li key={index}>{song}</li>)}
                            </ul>
                        </div>
                    )}
                    <div className="team-detail-section">
                        <h4>{isTeacherTeam ? '👨‍🏫' : '🕺'} 팀원 명단</h4>
                         <div className="team-members-grid">
                            {members.map((member, index) => (
                                <div key={index} className="special-list-item member-item">
                                    {member}{isTeacherTeam ? ' 선생님' : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MissionModal: React.FC<{ grade: string; missions: { [runner: string]: string[] }; onClose: () => void; }> = ({ grade, missions, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🏃 {grade}학년 미션</h3>
          <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
        </div>
        <div className="modal-body">
          {Object.entries(missions).map(([runner, classMissions]) => (
            <div key={runner} className="runner-mission-group">
              <h4>{runner}</h4>
              <ul className="class-mission-list">
                {classMissions.map((mission, index) => (
                  <li key={index}>{mission}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlayerListModal: React.FC<{ 
  grade: string; 
  playersForGrade: { [className: string]: PlayerData }; 
  onClose: () => void;
  eventTitle: string; 
}> = ({ grade, playersForGrade, onClose, eventTitle }) => {
  const isRunnerEvent = eventTitle === '미션 달리기' || eventTitle === '계주';
  const sortedClasses = useMemo(() => Object.keys(playersForGrade).sort((a, b) => a.localeCompare(b)), [playersForGrade]);
  const [activeClass, setActiveClass] = useState<string>(sortedClasses[0]);
  
  const isTugOfWar = eventTitle === '줄다리기';
  const tugOfWarCategories: (keyof TugOfWarPlayerClass)[] = ['women', 'men_vanguard', 'men_rearguard', 'reserve'];
  const [activeTugOfWarCategory, setActiveTugOfWarCategory] = useState<keyof TugOfWarPlayerClass>('women');

  // When activeClass changes, reset the sub-tab for tug of war
  useEffect(() => {
    setActiveTugOfWarCategory('women');
  }, [activeClass]);

  const playerDataForActiveClass = playersForGrade[activeClass] as PlayerData;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content player-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{`👥 ${grade}학년 ${eventTitle} 참가 선수`}</h3>
          <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
        </div>
        <div className="modal-body">
            <div className="tabs player-list-tabs">
              {sortedClasses.map(className => (
                <button
                  key={className}
                  className={`tab-button ${activeClass === className ? 'active' : ''}`}
                  onClick={() => setActiveClass(className)}
                  aria-pressed={activeClass === className}
                >
                  {className.split('-')[1]}반
                </button>
              ))}
            </div>
            <div className="player-list-content-tabbed">
               {isTugOfWar && typeof playerDataForActiveClass === 'object' && !Array.isArray(playerDataForActiveClass) ? (
                 <>
                  <div className="tabs sub-tabs">
                    {tugOfWarCategories.map(cat => {
                        let catName:string;
                        switch(cat) {
                            case 'women': catName = '여자'; break;
                            case 'men_vanguard': catName = '남자 (선발)'; break;
                            case 'men_rearguard': catName = '남자 (후발)'; break;
                            case 'reserve': catName = '예비'; break;
                            default: catName = cat;
                        }
                        return (
                             <button
                                key={cat}
                                className={`tab-button ${activeTugOfWarCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveTugOfWarCategory(cat)}
                                aria-pressed={activeTugOfWarCategory === cat}
                            >
                                {catName}
                            </button>
                        );
                    })}
                  </div>
                  {(() => {
                    const players = (playerDataForActiveClass as TugOfWarPlayerClass)[activeTugOfWarCategory];
                    if (players && players.length > 0) {
                      return (
                        <ul className="player-list-in-tab">
                          {players.map((player, index) => (
                            <li key={index}>{player}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p className="empty-player-list-message">해당 명단에 선수가 없습니다.</p>;
                  })()}
                 </>
               ) : Array.isArray(playerDataForActiveClass) ? (
                 <ul className="player-list-in-tab">
                   {playerDataForActiveClass.map((player, index) => (
                     <li key={index}>
                       {isRunnerEvent ? `${index + 1}번 주자: ${player}` : player}
                     </li>
                   ))}
                 </ul>
               ) : null}
            </div>
        </div>
      </div>
    </div>
  );
};

interface ScoreDetail {
  eventTitle: string;
  score: number;
}

const ScoreDetailModal: React.FC<{ 
    className: string; 
    details: ScoreDetail[]; 
    onClose: () => void; 
}> = ({ className, details, onClose }) => {
    const grade = className.split('-')[0];
    const classNum = className.split('-')[1];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content score-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📊 {grade}학년 {classNum}반 점수 내역</h3>
                    <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
                </div>
                <div className="modal-body">
                    {details.length > 0 ? (
                        <ul className="score-breakdown-list">
                            {details.map(({ eventTitle, score }) => (
                                <li key={eventTitle}>
                                    <span className="breakdown-event-title">{eventTitle}</span>
                                    <span className="breakdown-event-score">{score}점</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-scores-message">아직 획득한 점수가 없습니다.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const laneAssignments: { [eventTitle: string]: { [grade: string]: string[] } } = {
  '미션 달리기': {
    '1': ['1-5', '1-3', '1-4', '1-1', '1-2'],
    '2': ['2-2', '2-3', '2-1', '2-4'],
    '3': ['3-1', '3-2', '3-4', '3-5', '3-3'],
  },
  '계주': {
    '1': ['1-1', '1-2', '1-3', '1-4', '1-5'],
    '2': ['2-4', '2-2', '2-3', '2-1'],
    '3': ['3-5', '3-1', '3-3', '3-4', '3-2'],
  },
};

const LaneAssignmentModal: React.FC<{ grade: string; eventTitle: string; onClose: () => void; }> = ({ grade, eventTitle, onClose }) => {
  const lanes = laneAssignments[eventTitle]?.[grade] || [];
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content lane-assignment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{`👟 ${grade}학년 ${eventTitle} 레인 배정`}</h3>
          <button onClick={onClose} className="modal-close-button" aria-label="닫기">&times;</button>
        </div>
        <div className="modal-body">
          <div className="track-container">
            <div className="track-oval">
              <div className="lane-assignments">
                {lanes.map((className, index) => (
                  <div key={className} className="lane-item">
                    <div className="lane-number">{index + 1}</div>
                    <div className="lane-class-name">{className.split('-')[1]}반</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Scoreboard: React.FC<{ 
    scores: Scores; 
    eventTitle: string;
    missions?: { [grade: string]: { [runner: string]: string[] } };
    players?: { [grade: string]: { [className: string]: PlayerData } };
    onShowMission: (grade: string) => void;
    onShowPlayers: (grade: string) => void;
    onShowLanes: (grade: string) => void;
}> = ({ scores, eventTitle, missions, players, onShowMission, onShowPlayers, onShowLanes }) => {
  const isLaneEvent = eventTitle === '미션 달리기' || eventTitle === '계주';
  
  // FIX: Refactored to use Object.keys to prevent potential type inference issues with Object.entries, which was causing a downstream `.map` error.
  const scoresByGrade: Record<string, { className: string; score: number }[]> = useMemo(() => {
    return Object.keys(scores).reduce((acc: Record<string, { className: string; score: number }[]>, className) => {
      const grade = className.split('-')[0];
      const score = scores[className];
      if (!acc[grade]) acc[grade] = [];
      acc[grade].push({ className, score: Number(score) });
      return acc;
    }, {} as Record<string, { className: string; score: number }[]>);
  }, [scores]);

  return (
    <div className="scoreboard">
      {/* FIX: Replaced Object.entries with Object.keys to prevent a TypeScript type inference error. This ensures stable rendering of scores. */}
      {Object.keys(scoresByGrade).map((grade) => (
        <div key={grade} className="grade-score-group">
          <div className="grade-header">
            <h4 className="grade-title">{grade}학년</h4>
            <div className="grade-header-buttons">
              {missions && missions[grade] && (
                <button onClick={() => onShowMission(grade)} className="grade-action-button">
                  미션 보기
                </button>
              )}
              {players && players[grade] && (
                <button onClick={() => onShowPlayers(grade)} className="grade-action-button">
                  명단 보기
                </button>
              )}
              {isLaneEvent && players && players[grade] && (
                <button onClick={() => onShowLanes(grade)} className="grade-action-button">
                  레인 배정
                </button>
              )}
            </div>
          </div>
          <div className="class-scores-container">
            {scoresByGrade[grade].map(({ className, score }) => (
              <div key={className} className="team-score">
                <span className="team-name">{className.split('-')[1]}반</span>
                <span className="score">{score}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const TotalScoreboard: React.FC<{ events: SportsEvent[]; cheeringScores: Scores; }> = ({ events, cheeringScores }) => {
    const [activeTab, setActiveTab] = useState<'total' | 'cheering'>('total');
    const [modalClass, setModalClass] = useState<string | null>(null);

    const totalScoresByClass = useMemo(() => {
        const totals: Scores = {};
        events.forEach(event => {
            if (event.scores) {
                for (const [className, score] of Object.entries(event.scores)) {
                    if (!totals[className]) {
                        totals[className] = 0;
                    }
                    totals[className] += Number(score);
                }
            }
        });
        return totals;
    }, [events]);

    const scoreDetailsByClass = useMemo(() => {
        const details: { [className: string]: ScoreDetail[] } = {};
        events.forEach(event => {
            if (event.scores) {
                for (const className in event.scores) {
                    const score = event.scores[className];
                    if (score > 0) {
                        if (!details[className]) {
                            details[className] = [];
                        }
                        details[className].push({ eventTitle: event.title, score });
                    }
                }
            }
        });
        return details;
    }, [events]);

    // FIX: Explicitly typing `scoresByGrade` ensures TypeScript correctly infers its type, resolving the downstream error on classScores.map.
    const scoresByGrade: Record<string, { className: string; score: number }[]> = useMemo(() => {
        const scoresToProcess = activeTab === 'total' ? totalScoresByClass : cheeringScores;
        // FIX: Refactored to use Object.keys to prevent potential type inference issues with Object.entries.
        return Object.keys(scoresToProcess).reduce((acc: Record<string, { className: string; score: number }[]>, className) => {
            const grade = className.split('-')[0];
            const score = scoresToProcess[className];
            if (!acc[grade]) acc[grade] = [];
            acc[grade].push({ className, score: Number(score) });
            acc[grade].sort((a, b) => a.className.localeCompare(b.className));
            return acc;
        }, {} as Record<string, { className: string; score: number }[]>);
    }, [totalScoresByClass, cheeringScores, activeTab]);

    const handleClassClick = (className: string) => {
        if (activeTab === 'total') {
            setModalClass(className);
        }
    };
    
    const handleCloseModal = () => {
        setModalClass(null);
    };

    return (
        <>
            <div className="total-scoreboard-card">
                <div className="total-scoreboard-header">
                    <h3>{activeTab === 'total' ? '종합 점수 현황' : '질서 응원 점수 현황'}</h3>
                    <div className="tabs">
                        <button 
                            className={`tab-button ${activeTab === 'total' ? 'active' : ''}`}
                            onClick={() => setActiveTab('total')}
                            aria-pressed={activeTab === 'total'}
                        >
                            종합 점수
                        </button>
                        <button 
                            className={`tab-button ${activeTab === 'cheering' ? 'active' : ''}`}
                            onClick={() => setActiveTab('cheering')}
                            aria-pressed={activeTab === 'cheering'}
                        >
                            질서 응원 점수
                        </button>
                    </div>
                </div>
                {activeTab === 'total' ? (
                  <div className="scoring-guide">
                    <span className="scoring-guide-item">🥇 1등: <strong>50점</strong></span>
                    <span className="scoring-guide-item">🥈 2등: <strong>30점</strong></span>
                    <span className="scoring-guide-item">🥉 3등: <strong>20점</strong></span>
                    <span className="scoring-guide-item">🙌 참가: <strong>10점</strong></span>
                  </div>
                ) : (
                  <div className="cheering-guide">
                    <p>질서를 잘 지키고 응원을 열심히 해보자! 그렇다면 점수를 받을 수 있을거야!</p>
                  </div>
                )}
                <div className="total-scores-container">
                    {['1', '2', '3'].map(grade => {
                        const classScores = scoresByGrade[grade];
                        if (!classScores || classScores.length === 0) {
                            return null;
                        }
                        return (
                            <div key={grade} className="total-grade-group">
                                <h4 className="total-grade-title">{grade}학년</h4>
                                <div className="total-class-scores-grid">
                                    {classScores.map(({ className, score }) => (
                                        <button
                                            key={className}
                                            className={`total-class-score-item ${activeTab === 'total' ? 'clickable' : ''}`}
                                            onClick={() => handleClassClick(className)}
                                            disabled={activeTab !== 'total'}
                                            aria-label={`${className} 점수 상세보기`}
                                        >
                                            <span>{className.split('-')[1]}반:</span>
                                            <strong>{score}점</strong>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {modalClass && (
                <ScoreDetailModal 
                    className={modalClass}
                    details={scoreDetailsByClass[modalClass] || []}
                    onClose={handleCloseModal}
                />
            )}
        </>
    );
};


const EventCard: React.FC<{ event: SportsEvent; isExpanded: boolean; onToggle: () => void; colorIndex: number; onShowBracket: () => void; }> = ({ event, isExpanded, onToggle, colorIndex, onShowBracket }) => {
  const [selectedMissionGrade, setSelectedMissionGrade] = useState<string | null>(null);
  const [selectedPlayerListGrade, setSelectedPlayerListGrade] = useState<string | null>(null);
  const [selectedLaneGrade, setSelectedLaneGrade] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{
      title: string;
      teamName: string;
      members: string[];
      songs?: string[];
      isTeacherTeam?: boolean;
  } | null>(null);
  
  const hasDetails = event.rules || event.scores || event.lunchMenu || event.lineup || event.players || event.danceTeams || event.teacherTeams || event.gameFormat;
  const isCeremony = event.id === 0 || event.id === 6;
  const themeClass = `theme-color-${colorIndex}`;

  return (
    <>
      <div className={`event-card status-${event.status.toLowerCase()} ${themeClass}`}>
        <button 
          className="event-header" 
          onClick={hasDetails ? onToggle : undefined} 
          aria-expanded={isExpanded}
          aria-controls={`details-${event.id}`}
          disabled={!hasDetails}
        >
          <div className="event-time-location">
            <span className={'event-time' + (isCeremony ? ' ceremony-time' : '')}>{event.startTime} - {event.endTime}</span>
            <span className="event-location">{event.location}</span>
          </div>
          <h3 className={'event-title' + (isCeremony ? ' ceremony-title' : '')}>{event.title}</h3>
          <div className="event-status-container">
              <span className="status-badge">{event.status}</span>
              {hasDetails && <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▼</span>}
          </div>
        </button>
        {isExpanded && (
          <div id={`details-${event.id}`} className={`event-details detail-color-${colorIndex}`}>
            {(event.rules || event.gameFormat) && (
              <div className="rules-format-container">
                {event.rules && (
                  <div className="detail-section">
                    <h4>경기 규칙</h4>
                    <p>{event.rules}</p>
                  </div>
                )}
                {event.gameFormat && (
                  <div className="detail-section">
                    <h4>경기 방식</h4>
                    <p>{event.gameFormat}</p>
                  </div>
                )}
              </div>
            )}
            
            {event.danceTeams && (
              <div className="detail-section lineup">
                <h4>공연 라인업</h4>
                <div className="team-button-container">
                  {Object.entries(event.danceTeams).map(([teamName, teamData]) => (
                    <button
                      key={teamName}
                      className="team-button"
                      onClick={() => setSelectedTeam({ title: '댄스팀 공연', teamName, ...teamData, isTeacherTeam: false })}
                    >
                      {teamName}
                    </button>
                  ))}
                </div>
              </div>
            )}
             {event.teacherTeams && (
                <div className="detail-section">
                  <h4>참가 팀</h4>
                  <div className="team-button-container">
                    {Object.entries(event.teacherTeams).map(([teamName, members]) => (
                      <button
                        key={teamName}
                        className="team-button"
                        onClick={() => setSelectedTeam({ title: '교사 vs 교사 이벤트 계주', teamName, members, isTeacherTeam: true })}
                      >
                        {teamName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            {event.lunchMenu && (
              <div className="detail-section lunch-menu">
                <h4>오늘의 점심 메뉴</h4>
                <p>{event.lunchMenu}</p>
              </div>
            )}
            {event.title === '줄다리기' && (
                <div className="detail-section bracket-button-container">
                    <button onClick={onShowBracket} className="show-bracket-button">
                        ⚔️ 학년별 대진표 시뮬레이션
                    </button>
                </div>
            )}
            {event.scores && 
              <Scoreboard 
                scores={event.scores} 
                eventTitle={event.title}
                missions={event.missions}
                players={event.players}
                onShowMission={setSelectedMissionGrade}
                onShowPlayers={setSelectedPlayerListGrade}
                onShowLanes={setSelectedLaneGrade}
              />
            }
          </div>
        )}
      </div>
      {selectedMissionGrade && event.missions && event.missions[selectedMissionGrade] && (
        <MissionModal 
          grade={selectedMissionGrade}
          missions={event.missions[selectedMissionGrade]} 
          onClose={() => setSelectedMissionGrade(null)} 
        />
      )}
      {selectedPlayerListGrade && event.players && event.players[selectedPlayerListGrade] && (
        <PlayerListModal
          grade={selectedPlayerListGrade}
          playersForGrade={event.players[selectedPlayerListGrade]}
          onClose={() => setSelectedPlayerListGrade(null)}
          eventTitle={event.title}
        />
      )}
      {selectedLaneGrade && (
        <LaneAssignmentModal
            grade={selectedLaneGrade}
            eventTitle={event.title}
            onClose={() => setSelectedLaneGrade(null)}
        />
      )}
      {/* FIX: Replaced spread operator with explicit props to resolve a TypeScript error where the spread operator was disallowed on a potentially null type. */}
      {selectedTeam && (
        <TeamDetailModal
          onClose={() => setSelectedTeam(null)}
          title={selectedTeam.title}
          teamName={selectedTeam.teamName}
          members={selectedTeam.members}
          songs={selectedTeam.songs}
          isTeacherTeam={selectedTeam.isTeacherTeam}
        />
      )}
    </>
  );
};

const SportsDayApp: React.FC<{ sheetUrl: string; onResetUrl: () => void; }> = ({ sheetUrl, onResetUrl }) => {
  // Static base data, calculated once.
  const initialEvents = useMemo(() => getInitialEvents(), []);

  // State for dynamic data fetched from the sheet. This holds the latest snapshot.
  const [fetchedUpdates, setFetchedUpdates] = useState<SheetUpdates>({ 
      scoresByEvent: {}, 
      manualStatuses: {}, 
      cheeringScores: {},
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isBracketModalOpen, setIsBracketModalOpen] = useState(false);
  const [isAnnouncerModalOpen, setIsAnnouncerModalOpen] = useState(false);
  const fetchInProgress = useRef(false);

  // Data fetching and state update logic
  const loadEvents = useCallback(async ({ isInitialLoad = false } = {}) => {
    if (fetchInProgress.current) {
        console.log('Fetch already in progress. Skipping request.');
        return;
    }
    fetchInProgress.current = true;

    if (isInitialLoad) {
        setIsLoading(true);
        setError(null);
    }

    try {
      const newUpdates = await eventService.fetchEventUpdates(sheetUrl);
      
      setFetchedUpdates(prevUpdates => {
        // To enhance stability against temporary data source issues (e.g., partial CSV loads),
        // we check if a score category in the new data is empty while it previously contained data.
        // If so, we retain the old data for that category to prevent UI flickering.
        const finalScoresByEvent = (
            !isInitialLoad &&
            Object.keys(newUpdates.scoresByEvent).length === 0 && 
            Object.keys(prevUpdates.scoresByEvent).length > 0
          ) ? prevUpdates.scoresByEvent : newUpdates.scoresByEvent;
          
        const finalCheeringScores = (
            !isInitialLoad &&
            Object.keys(newUpdates.cheeringScores).length === 0 && 
            Object.keys(prevUpdates.cheeringScores).length > 0
          ) ? prevUpdates.cheeringScores : newUpdates.cheeringScores;

        return {
          scoresByEvent: finalScoresByEvent,
          manualStatuses: newUpdates.manualStatuses, // Always take the latest statuses
          cheeringScores: finalCheeringScores,
        };
      });

      setError(null);
    } catch (e: any) {
      if (isInitialLoad) {
          setError(e.message || '데이터를 불러오는데 실패했습니다. URL을 확인하거나 잠시 후 다시 시도해주세요.');
      }
      console.error(e); 
    } finally {
      if (isInitialLoad) setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [sheetUrl]);

  // Combine static initial data with dynamic fetched data for rendering.
  const events: SportsEvent[] = useMemo(() => {
    const currentTime = getCurrentTime();
    return initialEvents.map(baseEvent => {
      const eventScoresUpdates = fetchedUpdates.scoresByEvent[baseEvent.id];
      const manualStatus = fetchedUpdates.manualStatuses[baseEvent.id];

      const finalScores = baseEvent.scores 
        ? { ...baseEvent.scores, ...eventScoresUpdates } 
        : undefined;

      return {
        ...baseEvent,
        scores: finalScores,
        manualStatus: manualStatus,
        status: getEventStatus(baseEvent.startTime, baseEvent.endTime, currentTime, manualStatus),
      };
    });
  }, [initialEvents, fetchedUpdates]);


  useEffect(() => {
    loadEvents({ isInitialLoad: true });
    
    const pollInterval = setInterval(() => loadEvents(), 10000);

    return () => {
        clearInterval(pollInterval);
    };
  }, [loadEvents]);

  const handleToggle = (id: number) => {
    setExpandedId(prevId => (prevId === id ? null : id));
  };

  if (isLoading) {
    return <div className="loading-container">체육대회 정보를 불러오는 중입니다...</div>;
  }
  
  return (
    <div className="container">
      <header className="app-header">
        <h1>체육 한마당 실시간 현황</h1>
        <div className="header-buttons">
          <button onClick={() => setIsAnnouncerModalOpen(true)} className="header-action-button">
            🎤 아나운서
          </button>
          <button onClick={onResetUrl} className="exit-button">URL 재설정</button>
        </div>
      </header>
      <main>
        {error && <div className="error-message-bar">{error}</div>}
        <div className="warning-message-bar">
          <p>점수 업데이트가 이상한가요? 서비스 안정화를 위해 약 3분에서 5분 정도 기다리시면 정상적으로 반영될 수 있습니다.</p>
          <p>URL재설정을 눌렀다가 다시 들어오는 것도 방법입니다.</p>
        </div>
        <TotalScoreboard events={events} cheeringScores={fetchedUpdates.cheeringScores} />
        <div className="timeline">
          {events.map((event, index) => {
            let colorIndex = index % 7; // Cycle through 0-6
            if (event.title === '점심시간 및 뒷정리') {
              colorIndex = 9; // New medium gradient
            } else if (event.title === '폐회식') {
              colorIndex = 8; // Lighter gradient
            }
            return (
              <EventCard
                key={event.id}
                event={event}
                isExpanded={expandedId === event.id}
                onToggle={() => handleToggle(event.id)}
                colorIndex={colorIndex}
                onShowBracket={() => setIsBracketModalOpen(true)}
              />
            );
          })}
        </div>
      </main>
       <footer className="info-footer">
        <p>점수 현황은 10초마다 자동으로 업데이트됩니다.</p>
      </footer>
      {isBracketModalOpen && <TournamentBracketModal onClose={() => setIsBracketModalOpen(false)} />}
      {isAnnouncerModalOpen && <AnnouncerModal onClose={() => setIsAnnouncerModalOpen(false)} />}
    </div>
  );
};

const UrlInputPage: React.FC<{ onUrlSubmit: (url: string) => void; }> = ({ onUrlSubmit }) => {
    const [url, setUrl] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSdi6u7InsNQ2oEehLWh_x6y-Elrdq7XemPHsXllJodL-6uPu1cRzoYF3fLaXWsk9Qdz_9mBJ2H2F0E/pub?gid=0&single=true&output=csv";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onUrlSubmit(url.trim());
        }
    };
    
    const handleCopyClick = () => {
        navigator.clipboard.writeText(sheetCsvUrl).then(() => {
            setIsCopied(true);
            setUrl(sheetCsvUrl); // Auto-fill the form input
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
            alert('URL 복사에 실패했습니다.');
        }
        );
    };

    return (
        <div className="url-input-container">
            <header className="landing-header">
                <h1><span className="title-gradient">체육한마당</span> 🎉</h1>
                <p>실시간으로 체육대회 점수와 일정을 확인하세요!</p>
            </header>

            <div className="url-display-box">
                <p className="url-display-instruction">
                    아래 주소를 복사하여 입력창에 붙여넣거나, '복사' 버튼을 누르세요.<br/>
                    (버튼을 누르면 자동으로 입력됩니다)
                </p>
                <div className="url-copy-container">
                    <input type="text" value={sheetCsvUrl} readOnly aria-label="공유할 Google Sheet URL" />
                    <button onClick={handleCopyClick} className="copy-button" type="button">
                        {isCopied ? '복사 완료!' : '복사 & 입력'}
                    </button>
                </div>
            </div>

            <div className="url-input-box">
                <h2>Google Sheet URL 입력</h2>
                <p className="instructions">
                    관리자에게 공유받은 '웹에 게시된' Google Sheet CSV URL을 입력해주세요.
                </p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                        aria-label="Google Sheet URL"
                        required
                    />
                    <button type="submit">점수 보러가기</button>
                </form>
            </div>
        </div>
    );
};

const SHEET_URL_STORAGE_KEY = 'SPORTS_DAY_SHEET_URL';

const App: React.FC = () => {
  const [sheetUrl, setSheetUrl] = useState<string | null>(() => {
    return localStorage.getItem(SHEET_URL_STORAGE_KEY);
  });

  const handleUrlSubmit = (url: string) => {
    localStorage.setItem(SHEET_URL_STORAGE_KEY, url);
    setSheetUrl(url);
  };
  
  const handleResetUrl = () => {
    localStorage.removeItem(SHEET_URL_STORAGE_KEY);
    setSheetUrl(null);
  };

  if (sheetUrl) {
    return <SportsDayApp sheetUrl={sheetUrl} onResetUrl={handleResetUrl} />;
  } else {
    return <UrlInputPage onUrlSubmit={handleUrlSubmit} />;
  }
};

// --- Render App ---
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}