import { getArtistList, loadMoreAlbum } from '@soundx/services';
import { Image, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import MiniPlayer from '../../components/MiniPlayer';
import { groupAndSort, SectionData } from '../../utils/pinyin';
import { usePlayMode } from '../../utils/playMode';
import { getBaseURL } from '../../utils/request';
import './index.scss';

// Types
import { Album, Artist } from '@soundx/services';

export default function Library() {
  const { mode, setMode } = usePlayMode();
  const [activeTab, setActiveTab] = useState<'artists' | 'albums'>('artists');
  const [sections, setSections] = useState<SectionData<Artist | Album>[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setSections([]); // Clear previous data
    try {
      if (activeTab === 'artists') {
         // Load Artists
         const res = await getArtistList(1000, 0, mode);
         if (res.code === 200 && res.data) {
             const grouped = groupAndSort(res.data.list as Artist[], (item) => item.name);
             setSections(grouped);
         }
      } else {
          // Load Albums
          const res = await loadMoreAlbum({ pageSize: 1000, loadCount: 0, type: mode });
          if (res.code === 200 && res.data) {
             const grouped = groupAndSort(res.data.list as Album[], (item) => item.name);
             setSections(grouped);
          }
      }
    } catch (error) {
      console.error('Failed to load library data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode, activeTab]);

  useDidShow(() => {
      // Refresh logic if needed
  });

  const getImageUrl = (url: string | null) => {
      if (!url) return `https://picsum.photos/200/200`;
      if (url.startsWith('http')) return url;
      return `${getBaseURL()}${url}`;
  };

  return (
    <View className='library-container'>
      <View className='header'>
        <Text className='header-title'>声仓</Text>
        <View className='header-icons'>
             <View className='icon-btn' onClick={() => Taro.navigateTo({ url: '/pages/folder/index' })}>
                <Text className='icon-text'>📂</Text>
             </View>
             <View className='icon-btn' onClick={() => Taro.navigateTo({ url: '/pages/search/index' })}>
                <Text className='icon-text'>🔍</Text>
             </View>
             <View className='icon-btn' onClick={() => setMode(mode === 'MUSIC' ? 'AUDIOBOOK' : 'MUSIC')}>
                <Text className='icon-text'>{mode === 'MUSIC' ? '🎵' : '🎧'}</Text>
             </View>
        </View>
      </View>

      <View className='tabs-container'>
         <View className='tabs-bg'>
            <View 
                className={`tab-item ${activeTab === 'artists' ? 'active' : ''}`} 
                onClick={() => setActiveTab('artists')}
            >
                <Text className={`tab-text ${activeTab === 'artists' ? 'active-text' : ''}`}>艺术家</Text>
            </View>
            <View 
                className={`tab-item ${activeTab === 'albums' ? 'active' : ''}`} 
                onClick={() => setActiveTab('albums')}
            >
                <Text className={`tab-text ${activeTab === 'albums' ? 'active-text' : ''}`}>专辑</Text>
            </View>
         </View>
      </View>

      <ScrollView scrollY className='content-scroll' refresherEnabled onRefresherRefresh={loadData} refresherTriggered={loading}>
         {sections.map((section, index) => (
             <View key={section.title + index} className='section'>
                 <View className='section-header'>
                     <Text className='section-header-text'>{section.title}</Text>
                 </View>
                 <View className='grid-container'>
                     {section.data.map((item: any) => (
                         <View 
                            key={item.id} 
                            className='grid-item'
                            onClick={() => {
                                const url = activeTab === 'artists' 
                                    ? `/pages/artist/index?id=${item.id}` 
                                    : `/pages/album/index?id=${item.id}`;
                                Taro.navigateTo({ url });
                            }}
                         >
                            <Image 
                                src={getImageUrl(activeTab === 'artists' ? item.avatar : item.cover)} 
                                className={`item-image ${activeTab === 'artists' ? 'circle' : 'rounded'}`} 
                                mode='aspectFill'
                            />
                            <Text className='item-name' numberOfLines={1}>{item.name}</Text>
                         </View>
                     ))}
                 </View>
             </View>
         ))}
         {sections.length === 0 && !loading && (
             <View className='empty-state'>
                 <Text className='empty-text'>暂无数据</Text>
             </View>
         )}
      </ScrollView>

      <MiniPlayer />
    </View>
  );
}
