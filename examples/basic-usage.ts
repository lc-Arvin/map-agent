/**
 * 示例：基本使用
 */

import { MapAgent } from '../src/index.js';

const AMAP_KEY = process.env.AMAP_KEY || 'your_api_key_here';

async function basicExample() {
  const agent = new MapAgent({
    amapKey: AMAP_KEY,
  });

  console.log('=== 示例1：地理编码 ===');
  const geocodeResponse = await agent.query({
    query: '北京市朝阳区阜通东大街6号方恒国际中心',
  });
  console.log(geocodeResponse.text);
  console.log();

  console.log('=== 示例2：路径规划 ===');
  const routeResponse = await agent.query({
    query: '从北京南站到北京西站怎么走',
  });
  console.log(routeResponse.text);
  console.log();

  console.log('=== 示例3：POI搜索 ===');
  const searchResponse = await agent.query({
    query: '搜索北京朝阳公园附近的餐厅',
  });
  console.log(searchResponse.text);
  console.log();

  console.log('=== 示例4：逆地理编码 ===');
  const reverseResponse = await agent.query({
    query: '经度116.480881,纬度39.989410是什么地址',
  });
  console.log(reverseResponse.text);
}

basicExample().catch(console.error);
