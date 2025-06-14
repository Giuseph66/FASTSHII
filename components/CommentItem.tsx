import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from 'react-native';

interface Comment {
  userId: string;
  text: string;
  timestamp: number;
}

interface CommentItemProps {
  comment: Comment;
  username: string;
  isOwnComment: boolean;
  onMention: (comment: Comment) => void;
  onEdit: (newText: string) => void;
  onDelete: () => void;
  formatTime: (timestamp: number) => string;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  username,
  isOwnComment,
  onMention,
  onEdit,
  onDelete,
  formatTime,
}) => {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  // Defina as cores principais para usar nos estilos inline
  const textColor = themeColors.textSearch;
  const backgroundColor = themeColors.background;
  const primaryColor = themeColors.tint;
  const dangerColor = '#d00'; // vermelho padrão para ações destrutivas

  const handleEditSave = () => {
    onEdit(editText);
    setEditing(false);
  };

  return (
    <View style={[styles.commentItem, { backgroundColor: themeColors.backgroundfraco }]}>
      <View style={styles.commentHeader}>
        <Text style={[styles.commentUsername, { color: textColor }]}>{username}</Text>
        <Text style={[styles.commentTime, { color: textColor, opacity: 0.7 }]}>{formatTime(comment.timestamp)}</Text>
      </View>
      {editing ? (
        <View style={styles.editContainer}>
          <TextInput
            style={[styles.editInput, { color: textColor }]}
            value={editText}
            onChangeText={setEditText}
            multiline
          />
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: primaryColor }]} onPress={handleEditSave}>
            <Text style={[styles.actionText, { color: '#fff' }]}>Salvar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: dangerColor }]} onPress={() => setEditing(false)}>
            <Text style={[styles.actionText, { color: '#fff' }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={[styles.commentText, { color: textColor }]}>{comment.text}</Text>
      )}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onMention(comment)}>
          <Ionicons name="at-outline" size={18} color={textColor} />
          <Text style={[styles.actionText, { color: textColor }]}>Mencionar</Text>
        </TouchableOpacity>
        {isOwnComment && !editing && (
          <>
            <TouchableOpacity style={styles.actionButton} onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={18} color={textColor} />
              <Text style={[styles.actionText, { color: textColor }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color={dangerColor} />
              <Text style={[styles.actionText, { color: dangerColor }]}>Apagar</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  commentItem: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentTime: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 13,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  editInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    marginRight: 8,
  },
  saveButton: {
    borderRadius: 8,
    padding: 6,
    marginRight: 4,
  },
  cancelButton: {
    borderRadius: 8,
    padding: 6,
  },
});

export default CommentItem; 