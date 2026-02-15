import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useURL } from 'expo-linking';
import { isFileImportUrl, readSharedFile } from '@/services/fileImportService';

export default function NotFoundScreen() {
  const router = useRouter();
  const incomingUrl = useURL();

  useEffect(() => {
    if (!incomingUrl || !isFileImportUrl(incomingUrl)) {
      // Not a file import URL — go home
      router.replace('/');
      return;
    }

    readSharedFile(incomingUrl).then((result) => {
      if (result.success && result.markdown) {
        router.replace({
          pathname: '/modal/import',
          params: { prefilledMarkdown: result.markdown, fileName: result.fileName },
        });
      } else {
        Alert.alert('Import Error', result.error || 'Failed to read file.', [
          { text: 'OK', onPress: () => router.replace('/') },
        ]);
      }
    });
  }, [incomingUrl]);

  return null;
}
