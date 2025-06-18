import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  maxDuration?: number; // Duração máxima em dias
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  minimumDate,
  maximumDate,
  error,
  maxDuration,
}) => {
  const [show, setShow] = useState(false);
  const [selectedDate, setSelectedDate] = useState(value);
  const [selectedYear, setSelectedYear] = useState(value.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(value.getMonth());
  const [selectedDay, setSelectedDay] = useState(value.getDate());
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const windowWidth = Dimensions.get('window').width;

  useEffect(() => {
    setSelectedDate(value);
    setSelectedYear(value.getFullYear());
    setSelectedMonth(value.getMonth());
    setSelectedDay(value.getDate());
  }, [value]);

  const handleConfirm = () => {
    const newDate = new Date(selectedYear, selectedMonth, selectedDay);
    onChange(newDate);
    setShow(false);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    const startYear = minimumDate ? minimumDate.getFullYear() : currentYear - 100;
    const endYear = maximumDate ? maximumDate.getFullYear() : currentYear + 100;

    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  };

  const generateMonths = () => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months;
  };

  const generateDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  const isDateDisabled = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    
    // Verifica data mínima
    if (minimumDate && date < minimumDate) return true;
    
    // Verifica data máxima
    if (maximumDate && date > maximumDate) return true;
    
    // Verifica duração máxima se houver data mínima e duração máxima definida
    if (minimumDate && maxDuration) {
      const maxDate = new Date(minimumDate);
      maxDate.setDate(maxDate.getDate() + maxDuration);
      if (date > maxDate) return true;
    }
    
    return false;
  };

  const renderDateSelector = () => {
    const years = generateYears();
    const months = generateMonths();
    const days = generateDays();

    return (
      <View style={styles.selectorContainer}>
        <View style={styles.selectorColumn}>
          <Text style={[styles.selectorTitle, { color: themeColors.textSearch}]}>
            Ano
          </Text>
          <ScrollView style={styles.selectorScroll}>
            {years.map((year) => (
              <TouchableOpacity
                key={year}
                style={[
                  styles.selectorItem,
                  selectedYear === year && [styles.selectedItem, { backgroundColor: themeColors.tint , borderColor: themeColors.tint }],
                ]}
                onPress={() => setSelectedYear(year)}
              >
                <Text style={[
                  styles.selectorItemText,
                  { color: themeColors.textSearch},
                  selectedYear === year && [styles.selectedItemText, { color: '#fff'}]
                ]}>
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.selectorColumn}>
          <Text style={[styles.selectorTitle, { color: themeColors.textSearch}]}>
            Mês
          </Text>
          <ScrollView style={styles.selectorScroll}>
            {months.map((month, index) => (
              <TouchableOpacity
                key={month}
                style={[
                  styles.selectorItem,
                  selectedMonth === index && [styles.selectedItem, { backgroundColor: themeColors.tint , borderColor: themeColors.tint }],
                ]}
                onPress={() => setSelectedMonth(index)}
              >
                <Text style={[
                  styles.selectorItemText,
                  { color: themeColors.textSearch},
                  selectedMonth === index && [styles.selectedItemText, { color: '#fff'}]
                ]}>
                  {month}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.selectorColumn}>
          <Text style={[styles.selectorTitle, { color: themeColors.textSearch}]}>
            Dia
          </Text>
          <ScrollView style={styles.selectorScroll}>
            {days.map((day) => {
              const disabled = isDateDisabled(selectedYear, selectedMonth, day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.selectorItem,
                    selectedDay === day && [styles.selectedItem, { backgroundColor: themeColors.tint , borderColor: themeColors.tint }],
                    disabled && styles.disabledItem
                  ]}
                  onPress={() => !disabled && setSelectedDay(day)}
                  disabled={disabled}
                >
                  <Text style={[
                    styles.selectorItemText,
                    { color: themeColors.textSearch},
                    selectedDay === day && [styles.selectedItemText, { color: '#fff'}],
                    disabled && styles.disabledItemText
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: themeColors.textSearch}]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.dateButton,
          { 
            backgroundColor: themeColors.backgroundfraco,
            borderColor: error ? '#ff4444' : colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }
        ]}
        onPress={() => setShow(true)}
      >
        <Ionicons 
          name="calendar" 
          size={24} 
          color={colorScheme === 'dark' ? themeColors.textSearch : '#000'} 
        />
        <Text style={[styles.dateText, { color: themeColors.textSearch}]}>
          {formatDate(value)}
        </Text>
      </TouchableOpacity>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      <Modal
        visible={show}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent,
            { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#fff' }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.textSearch}]}>
                Selecione a Data
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShow(false)}
              >
                <Ionicons 
                  name="close" 
                  size={24} 
                  color={colorScheme === 'dark' ? themeColors.textSearch : '#000'} 
                />
              </TouchableOpacity>
            </View>

            {renderDateSelector()}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: '#ff4444' }]}
                onPress={() => setShow(false)}
              >
                <Text style={styles.footerButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerButton, { backgroundColor: themeColors.tint }]}
                onPress={handleConfirm}
              >
                <Text style={styles.footerButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 16,
    marginLeft: 12,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 300,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 12,
    padding: 8,
  },
  selectorColumn: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    padding: 4,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  selectorScroll: {
    flex: 1,
    borderRadius: 8,
  },
  selectorItem: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedItem: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  selectedItemText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledItem: {
    opacity: 0.5,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  disabledItemText: {
    color: '#999',
  },
  selectorItemText: {
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  footerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default DatePicker; 