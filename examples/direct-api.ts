/**
 * 示例：直接使用工具API
 */

import { AMapClient } from '../src/index.js';

const AMAP_KEY = process.env.AMAP_KEY || 'your_api_key_here';

async function directAPIExample() {
  const client = new AMapClient({
    amapKey: AMAP_KEY,
  });

  console.log('=== 直接使用API客户端 ===\n');

  // 1. 地理编码
  console.log('1. 地理编码');
  try {
    const geocodeResult = await client.geocode({
      address: '北京市朝阳区阜通东大街6号',
      city: '北京',
    });
    console.log('结果：', JSON.stringify(geocodeResult.geocodes[0], null, 2));
  } catch (error) {
    console.error('错误：', error);
  }
  console.log();

  // 2. POI搜索
  console.log('2. POI搜索');
  try {
    const poiResult = await client.searchPOI({
      keywords: '餐厅',
      city: '北京',
      offset: 5,
    });
    console.log(`找到 ${poiResult.count} 个结果`);
    console.log('前5个：');
    poiResult.pois.forEach((poi, i) => {
      console.log(`  ${i + 1}. ${poi.name} - ${poi.address}`);
    });
  } catch (error) {
    console.error('错误：', error);
  }
  console.log();

  // 3. 路径规划
  console.log('3. 路径规划');
  try {
    const routeResult = await client.route({
      origin: '116.481028,39.989673',
      destination: '116.434446,39.90816',
    });
    const path = routeResult.route.paths[0];
    console.log(`距离：${path.distance}米`);
    console.log(`时间：${Math.round(parseInt(path.duration) / 60)}分钟`);
    console.log(`步骤数：${path.steps.length}`);
  } catch (error) {
    console.error('错误：', error);
  }
  console.log();

  // 4. 静态地图
  console.log('4. 静态地图');
  try {
    const mapResult = await client.staticMap({
      location: '116.481028,39.989673',
      zoom: 15,
      size: '600x400',
      markers: 'mid,A:116.481028,39.989673',
    });
    console.log('地图URL：', mapResult.url);
  } catch (error) {
    console.error('错误：', error);
  }
}

directAPIExample().catch(console.error);
