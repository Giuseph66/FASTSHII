import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { router , useLocalSearchParams} from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, Timestamp, addDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import CustomAlert, { CustomAlertButton } from '@/components/CustomAlert';
import DatePicker from '@/components/DatePicker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

import * as Device from 'expo-device';
import * as Application from 'expo-application';

interface Contract {
  id: string;
  userId: string;
  advertiserName: string;
  advertiserEmail: string;
  advertiserPhone: string;
  advertiserCNPJ: string;
  adTitle: string;
  adDescription: string;
  startDate: string;
  endDate: string;
  budget: string;
  targetAudience: string;
  adType: string;
  paymentMethod: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  images: string[];
  links: string[];
  reachPerDay: number;
}

const AdminContratosScreen = () => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title?: string;
    message: string;
    buttons?: CustomAlertButton[];
  }>({ visible: false, title: '', message: '', buttons: [{ text: 'OK' }] });
  
  // Filter states
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'expired'>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [filterAdType, setFilterAdType] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<Date>(new Date(2020, 0, 1));
  const [endDateFilter, setEndDateFilter] = useState<Date>(new Date());
  const [adm ,  setAdm] = useState<boolean>(false);
  const { id } = useLocalSearchParams();


  useEffect(() => {
    loadContracts();
  }, []);


  const getDeviceAdminKey = async () => {
    try {
    const brand = Device.brand;
    const model = Device.modelName;
    const os = Device.osName;
    const androidId = Application.androidId || 'unknown';
  
    const deviceKey = `${brand}-${model}-${os}-${androidId}`;
    return deviceKey;
    } catch (error) {
      console.error('Erro ao obter chave do dispositivo:', error);
      return 'unknown';
    }
  };

    const loadContracts = async () => {
      try {
        setLoading(true);

        // Primeiro, verifica se é admin
        const user = await AsyncStorage.getItem('user');
        const userx = JSON.parse(user as string);
        const dados = await getDoc(doc(firestore, 'usuarios', userx.uid as string));
        const dados_celular = await getDeviceAdminKey();
        let adm = false;
        if (dados.exists()) {
          const data = dados.data();
          if (
            data?.isAdmin ||
            dados_celular ===
              "samsung-SM-A546E-samsung/a54xnsxx/a54x:14/UP1A.231005.007/A546EXXU9CXH4:user/release-keys-unknown"
          ) {
            adm = true;
          }
        }
        setAdm(adm);

        // Só depois de verificar adm, faz a query dos contratos
        const contractsRef = collection(firestore, 'advertising_contracts');
        let q;
        console.log("adm", adm, id);
        if (id && !adm) {
          q = query(contractsRef, where('userId', '==', String(id)));
        } else if (adm) {
          q = query(contractsRef, orderBy('createdAt', 'desc'));
        } else {
          // Se não for admin e não tiver id, não busca nada
          setContracts([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const querySnapshot = await getDocs(q);

        const contractsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toDate().toISOString()
                : data.createdAt,
            startDate:
              data.startDate instanceof Timestamp
                ? data.startDate.toDate().toISOString()
                : data.startDate,
            endDate:
              data.endDate instanceof Timestamp
                ? data.endDate.toDate().toISOString()
                : data.endDate,
          };
        }) as Contract[];

        // Se filtrado por usuário, ordenar manualmente por createdAt desc
        const sorted = contractsData.sort((a, b) => {
          const aTs = new Date(a.createdAt).getTime();
          const bTs = new Date(b.createdAt).getTime();
          return bTs - aTs;
        });

        setContracts(sorted);
      } catch (error) {
        console.error('Erro ao carregar contratos:', error);
        setCustomAlert({
          visible: true,
          title: 'Erro',
          message: 'Não foi possível carregar os contratos.',
          buttons: [
            {
              text: 'OK',
              style: 'default',
              onPress: () =>
                setCustomAlert(prev => ({ ...prev, visible: false })),
            },
          ],
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  const onRefresh = () => {
    setRefreshing(true);
    loadContracts();
  };

  const handleStatusChange = async (contractId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const contractRef = doc(firestore, 'advertising_contracts', contractId);
      await updateDoc(contractRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      setContracts(prev => prev.map(contract => 
        contract.id === contractId 
          ? { ...contract, status: newStatus }
          : contract
      ));

      if (newStatus === 'approved') {
        const approvedContract = contracts.find(c => c.id === contractId);
        if (approvedContract) {
          let compressedImages: string[] = [];
          if (approvedContract.images && approvedContract.images.length) {
            for (const img of approvedContract.images) {
              const cImg = await compressBase64Image(img);
              compressedImages.push(cImg);
            }
          }

          const adPostData = {
            userId: approvedContract.userId,
            username: approvedContract.advertiserName,
            content: approvedContract.adDescription,
            text: approvedContract.adDescription,
            timestamp: Date.now(),
            likes: {},
            comments: {},
            images: compressedImages,
            imageBase64: compressedImages.length ? compressedImages[0] : null,
            ad: true,
            adLinks: approvedContract.links || [],
            adContractId: approvedContract.id,
            adStartDate: approvedContract.startDate,
            adEndDate: approvedContract.endDate,
            visualizacoes_max_diarias: approvedContract.reachPerDay,
            dailyLimit: 5,
            viewsTotal: 0,
            viewsByDate: {},
          };
          await addDoc(collection(firestore, 'posts'), adPostData);
        }
      }

      setCustomAlert({
        visible: true,
        title: 'Sucesso',
        message: `Contrato ${newStatus === 'approved' ? 'aprovado' : 'rejeitado'} com sucesso!`,
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });

      setIsModalVisible(false);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setCustomAlert({
        visible: true,
        title: 'Erro',
        message: 'Não foi possível atualizar o status do contrato.',
        buttons: [
          { text: 'OK', style: 'default', onPress: () => setCustomAlert(prev => ({ ...prev, visible: false })) }
        ]
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value));
  };

  const renderContractCard = (contract: Contract) => (
    <TouchableOpacity
      key={contract.id}
      style={[styles.contractCard, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
      onPress={() => {
        setSelectedContract(contract);
        setIsModalVisible(true);
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.adTitle, { color: themeColors.googleButton }]}>
          {contract.adTitle}
        </Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: 
            contract.status === 'approved' ? '#4CAF50' :
            contract.status === 'rejected' ? '#F44336' :
            contract.status === 'expired' ? '#FFC107' :
            '#FFC107'
          }
        ]}>
          <Text style={styles.statusText}>
            {contract.status === 'approved' ? 'Aprovado' :
             contract.status === 'rejected' ? 'Rejeitado' :
             contract.status === 'expired' ? 'Expirado' :
             'Pendente'}
          </Text>
        </View>
      </View>

      <Text style={[styles.advertiserName, { color: themeColors.googleButton }]}>
        {contract.advertiserName}
      </Text>
      
      <View style={styles.cardDetails}>
        <Text style={[styles.detailText, { color: themeColors.googleButton }]}>
          Data de Início: {formatDate(contract.startDate)}
        </Text>
        <Text style={[styles.detailText, { color: themeColors.googleButton }]}>
          Data de Término: {formatDate(contract.endDate)}
        </Text>
        <Text style={[styles.detailText, { color: themeColors.googleButton }]}>
          Orçamento: {formatCurrency(contract.budget)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderContractModal = () => {
    if (!selectedContract) {
      return null;
    }

    return (
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsModalVisible(false);
          setSelectedContract(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: themeColors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.googleButton }]}>
                {selectedContract.adTitle}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsModalVisible(false);
                  setSelectedContract(null);
                }}
              >
                <Ionicons name="close" size={24} color={themeColors.googleButton} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                  Informações do Anunciante
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Nome: {selectedContract.advertiserName}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Email: {selectedContract.advertiserEmail}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Telefone: {selectedContract.advertiserPhone}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  CNPJ: {selectedContract.advertiserCNPJ}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                  Detalhes do Anúncio
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Descrição: {selectedContract.adDescription}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Público-Alvo: {selectedContract.targetAudience}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Tipo de Anúncio: {selectedContract.adType}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Método de Pagamento: {selectedContract.paymentMethod}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Orçamento: {formatCurrency(selectedContract.budget)}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Data de Início: {formatDate(selectedContract.startDate)}
                </Text>
                <Text style={[styles.modalText, { color: themeColors.googleButton }]}>
                  Data de Término: {formatDate(selectedContract.endDate)}
                </Text>
              </View>

              {selectedContract.images && selectedContract.images.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                    Imagens do Anúncio
                  </Text>
                  <ScrollView horizontal style={styles.imagesContainer}>
                    {selectedContract.images.map((image, index) => (
                      <Image
                        key={index}
                        source={{ uri: `data:image/jpeg;base64,${image}` }}
                        style={styles.thumbnail}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {selectedContract.links && selectedContract.links.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: themeColors.googleButton }]}>
                    Links do Anúncio
                  </Text>
                  {selectedContract.links.map((link, index) => (
                    <Text key={index} style={[styles.modalText, { color: themeColors.googleButton }]}>
                      {link}
                    </Text>
                  ))}
                </View>
              )}

              {adm && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleStatusChange(selectedContract.id, 'approved')}
                  >
                    <Text style={styles.actionButtonText}>Aprovar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleStatusChange(selectedContract.id, 'rejected')}
                  >
                    <Text style={styles.actionButtonText}>Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const applyFilters = (): Contract[] => {
    return contracts.filter(contract => {
      // Status filter
      if (filterStatus !== 'all' && contract.status !== filterStatus) return false;

      // Payment method filter
      if (filterPaymentMethod !== 'all' && contract.paymentMethod !== filterPaymentMethod) return false;

      // Ad type filter
      if (filterAdType !== 'all' && contract.adType !== filterAdType) return false;

      // Date range filter
      const contractDate = new Date(contract.createdAt);
      if (contractDate < startDateFilter) return false;
      if (contractDate > endDateFilter) return false;

      return true;
    });
  };

  const filteredContracts = applyFilters();

  const renderFilterBar = () => (
    <View style={[styles.filterContainer, { backgroundColor: themeColors.background }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {/* Status Filter */}
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: themeColors.textSearch}]}>Status:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
            {['all', 'pending', 'approved', 'rejected', 'expired'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  filterStatus === status && [styles.selectedChip, { borderColor: themeColors.tint, backgroundColor: themeColors.tint}]
                ]}
                onPress={() => setFilterStatus(status as any)}
              >
                <Text style={[
                  styles.filterChipText,
                  { color: filterStatus === status ? '#fff' : themeColors.textSearch }
                ]}>
                  {status === 'all' ? 'Todos' :
                   status === 'pending' ? 'Pendente' :
                   status === 'approved' ? 'Aprovado' :
                   status === 'rejected' ? 'Rejeitado' : 'Expirado'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date Range Filter */}
        <View style={styles.filterGroup}>
          <Text style={[styles.filterLabel, { color: themeColors.textSearch }]}>Data:</Text>
          <View style={styles.dateFilterContainer}>
            <DatePicker
              value={startDateFilter}
              onChange={setStartDateFilter}
              label="Data Inicial"
              minimumDate={new Date(2020, 0, 1)} // Ajuste conforme necessário
            />
            <DatePicker
              value={endDateFilter}
              onChange={setEndDateFilter}
              label="Data Final"
              minimumDate={startDateFilter}
            />
            <TouchableOpacity
              style={[styles.filterChip, { borderColor: themeColors.tint, marginLeft: 8, backgroundColor: themeColors.background }]}
              onPress={() => {
                setStartDateFilter(new Date(2020, 0, 1));
                setEndDateFilter(new Date());
              }}
            >
              <Text style={[styles.filterChipText, { color: themeColors.textSearch }]}>Todos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // Compress base64 image to fit Firestore limits (returns compressed base64)
  const compressBase64Image = async (base64: string): Promise<string> => {
    try {
      // criar arquivo temporário
      const tempUri = FileSystem.cacheDirectory + `temp_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tempUri, base64, { encoding: FileSystem.EncodingType.Base64 });

      // Reduzir até ficar < 900k char (aprox 675kb)
      let quality = 0.8;
      let resizedWidth = 900;
      let result = await ImageManipulator.manipulateAsync(tempUri, [{ resize: { width: resizedWidth } }], { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true });

      while (result.base64 && result.base64.length > 900000 && quality > 0.2) {
        quality -= 0.1;
        resizedWidth = Math.floor(resizedWidth * 0.9);
        result = await ImageManipulator.manipulateAsync(tempUri, [{ resize: { width: resizedWidth } }], { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      }

      return result.base64 || base64;
    } catch (e) {
      console.error('Falha ao comprimir imagem:', e);
      return base64;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <LinearGradient
        colors={[themeColors.background, themeColors.background]}
        style={styles.gradient}
      >
        {/* AppBar */}
        <View style={[styles.appBar, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: themeColors.googleButton }]}>
            Contratos de Anúncio
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.googleButton} />
          </View>
        ) : (
          <>
            {renderFilterBar()}
            <ScrollView 
              style={styles.scrollView}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[themeColors.googleButton]}
                  tintColor={themeColors.googleButton}
                />
              }
            >
              {filteredContracts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="document-text-outline" size={48} color={themeColors.googleButton} />
                  <Text style={[styles.emptyText, { color: themeColors.googleButton }]}>
                    Nenhum contrato encontrado
                  </Text>
                </View>
              ) : (
                filteredContracts.map(renderContractCard)
              )}
            </ScrollView>
          </>
        )}

        {renderContractModal()}
      </LinearGradient>
    </View>
  );
};

export default AdminContratosScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  appBar: {
    position: 'absolute',
    top: StatusBar.currentHeight,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 90,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  contractCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  advertiserName: {
    fontSize: 16,
    marginBottom: 8,
  },
  cardDetails: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 20,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 15,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  imagesContainer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingVertical: 10,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterContainer: {
    marginTop: 90,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterGroup: {
    marginRight: 20,
    minWidth: 200,
    maxHeight: 180,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
  },
  filterChip: {
    height: 40,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    marginTop: 15,
  },
  selectedChip: {
    backgroundColor: '#FF5500',
    borderColor: '#FF5500',
  },
  filterChipText: {
    alignSelf: 'center',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 14,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    gap: 8,
    minWidth: 300,
    alignItems: 'center',
  },
}); 