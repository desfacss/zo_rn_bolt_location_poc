import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {getOneShotLocation} from '../background/BackgroundTracker';

export default function TestLocationButton() {
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');

  const onPress = async () => {
    setError('');
    try {
      const loc = await getOneShotLocation();
      setLast(loc);
      console.log('[TestButton] One-shot location:', loc);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  return (
    <View style={{gap: 12, padding: 16}}>
      <Pressable
        onPress={onPress}
        style={{backgroundColor: '#222', padding: 12, borderRadius: 10}}>
        <Text style={{color: 'white', textAlign: 'center'}}>Get One-shot Location</Text>
      </Pressable>

      {last && (
        <Text>
          Last: {last.latitude.toFixed(5)}, {last.longitude.toFixed(5)} • acc ±
          {typeof last.accuracy === 'number' ? last.accuracy.toFixed(0) : '?'} m
        </Text>
      )}
      {!!error && <Text style={{color: 'red'}}>{error}</Text>}
    </View>
  );
}

